using System.Reflection;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Sessions.Queries.GetSessionHandHistory;
using PokerApp.Domain.Entities;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Tests;

/// <summary>
/// What the hand-history endpoint may put on the wire (audit 2026-08-03, HIGH #4).
///
/// `HandRecord.CreatedByUserId` was returned verbatim in `HandRecordDto` — the raw account GUID of
/// whoever logged the hand, served to every participant of the session, and (having no modelled FK)
/// never cleared when that account was deleted. The client's only use for it was comparing it to
/// the signed-in user's id to decide whether to draw the delete button.
///
/// So the id is gone from the response and replaced by the ANSWER the client actually needed:
/// `IsMine`, computed server-side from the same rule DeleteHandRecordCommandHandler enforces.
/// That removes the identifier from the wire entirely — stronger than merely scrubbing it on
/// deletion — while keeping the affordance working. Dropping the field outright, as first planned,
/// would have silently disabled the delete button for everyone (SessionScreen compared an
/// `undefined` to the user id, which is never true).
/// </summary>
public sealed class HandHistoryPrivacyTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly AppDbContext _ctx;

    public HandHistoryPrivacyTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        _ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options);
        _ctx.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _ctx.Dispose();
        _conn.Dispose();
    }

    private sealed class FakeCurrentUser(Guid id) : ICurrentUserService
    {
        public Guid UserId { get; } = id;
        public string? Email => "host@example.com";
        public string? Username => "host";
        public bool IsAuthenticated => true;
    }

    [Fact]
    public void The_hand_history_DTO_exposes_no_account_identifier()
    {
        // Pinned on the SHAPE, not on one property name: any Guid member that is not the hand's own
        // id would put an account identifier back on the wire under a new name.
        var offenders = typeof(HandRecordDto).GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => (p.PropertyType == typeof(Guid) || p.PropertyType == typeof(Guid?))
                        && p.Name != nameof(HandRecordDto.Id))
            .Select(p => p.Name)
            .ToArray();

        Assert.Empty(offenders);
        Assert.DoesNotContain(typeof(HandRecordDto).GetProperties(),
            p => p.Name.Contains("CreatedBy", StringComparison.Ordinal));
    }

    [Fact]
    public async Task IsMine_is_true_only_for_the_hand_the_caller_logged()
    {
        // The affordance the removed GUID used to drive. Computed server-side from the same rule
        // DeleteHandRecordCommandHandler enforces ("You can only delete hands you logged"), so the
        // client no longer needs an account id to render the button — and cannot drift from the
        // server's rule.
        var host = User.Create("host", "host@example.com", "hash");
        var mate = User.Create("mate", "mate@example.com", "hash");
        _ctx.Users.AddRange(host, mate);
        var session = Session.Create("Friday night", host.Id);   // standalone: host is the creator
        session.Start();
        _ctx.Sessions.Add(session);
        _ctx.HandRecords.Add(HandRecord.Create(session.Id, "Dan", 120m, null, host.Id));
        _ctx.HandRecords.Add(HandRecord.Create(session.Id, "Ann", 80m, null, mate.Id));
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        var hands = await new GetSessionHandHistoryQueryHandler(_ctx, new FakeCurrentUser(host.Id))
            .Handle(new GetSessionHandHistoryQuery(session.Id), CancellationToken.None);

        Assert.Equal(2, hands.Count);
        Assert.True(hands.Single(h => h.WinnerName == "Dan").IsMine);
        Assert.False(hands.Single(h => h.WinnerName == "Ann").IsMine);
    }

    [Fact]
    public async Task A_scrubbed_creator_never_reads_as_mine()
    {
        // After deletion the creator id is Guid.Empty. Nobody's account id is Guid.Empty, so the
        // hand cannot come back as somebody's own — but the comparison is pinned rather than
        // assumed, because `default(Guid)` matching a caller would hand a stranger the delete
        // affordance on a departed player's hand.
        var host = User.Create("host", "host@example.com", "hash");
        _ctx.Users.Add(host);
        var session = Session.Create("Friday night", host.Id);
        session.Start();
        _ctx.Sessions.Add(session);
        var hand = HandRecord.Create(session.Id, "Dan", 120m, null, Guid.NewGuid());
        _ctx.HandRecords.Add(hand);
        _ctx.SaveChanges();
        hand.AnonymizeCreator();
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        var hands = await new GetSessionHandHistoryQueryHandler(_ctx, new FakeCurrentUser(host.Id))
            .Handle(new GetSessionHandHistoryQuery(session.Id), CancellationToken.None);

        Assert.False(Assert.Single(hands).IsMine);
    }
}
