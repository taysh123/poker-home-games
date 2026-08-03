using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Groups.Commands.DeleteGroup;
using PokerApp.Application.Features.Sessions.Commands.DeleteSession;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// The CLASS behind the account-deletion defect: a delete handler that relies on the database to
/// clean up after it, with no test that ever exercises a database which enforces the constraints.
/// Account deletion was the instance that reached production; these are the sibling delete paths.
///
/// Both handlers below delete an aggregate root and trust EF cascades — DeleteSession even says so
/// in a comment ("EF cascade deletes: BuyIns, CashOuts, Settlements, SessionPlayers, HandRecords").
/// That comment asserts a guarantee, which under this repo's standing rules needs a test or it
/// should not be written. It had none, and the InMemory provider every other backend test uses
/// could never have supplied one, because it enforces no referential integrity at all.
///
/// Same honest limit as DeleteAccountFkIntegrityTests: SQLite is not Postgres. What transfers is
/// the FK topology generated from the same EF model and whether a cascade is actually declared.
/// </summary>
public sealed class AggregateDeleteFkIntegrityTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly AppDbContext _ctx;

    public AggregateDeleteFkIntegrityTests()
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

    private sealed class FakeCurrentUser(Guid id, string name) : ICurrentUserService
    {
        public Guid UserId { get; } = id;
        public string? Email => $"{name}@example.com";
        public string? Username { get; } = name;
        public bool IsAuthenticated => true;
    }

    /// <summary>A group with one full session: players, money on both sides, settlements, hands.</summary>
    private (User owner, Group group, Session session) SeedGroupWithFullSession()
    {
        var owner = User.Create("owner", "owner@example.com", "hash");
        var member = User.Create("member", "member@example.com", "hash");
        _ctx.Users.AddRange(owner, member);

        var group = Group.Create("Thursday Game", null, owner.Id);
        _ctx.Groups.Add(group);
        _ctx.GroupMembers.Add(GroupMember.Create(group.Id, owner.Id, GroupRole.Owner));
        _ctx.GroupMembers.Add(GroupMember.Create(group.Id, member.Id, GroupRole.Member));

        var session = Session.Create("Session 1", owner.Id, group.Id);
        session.Start();
        session.End();
        _ctx.Sessions.Add(session);

        var spOwner = SessionPlayer.CreateForUser(session.Id, owner.Id);
        var spMember = SessionPlayer.CreateForUser(session.Id, member.Id);
        var spGuest = SessionPlayer.CreateForGuest(session.Id, "Dan", member.Id);
        _ctx.SessionPlayers.AddRange(spOwner, spMember, spGuest);

        _ctx.BuyIns.Add(BuyIn.Create(session.Id, spOwner.Id, 100m));
        _ctx.BuyIns.Add(BuyIn.Create(session.Id, spMember.Id, 100m));
        _ctx.CashOuts.Add(CashOut.Create(session.Id, spOwner.Id, 140m));
        _ctx.CashOuts.Add(CashOut.Create(session.Id, spMember.Id, 60m));
        _ctx.Settlements.Add(Settlement.Create(session.Id, member.Id, owner.Id, 40m));
        _ctx.HandRecords.Add(HandRecord.Create(session.Id, "owner", 200m, "big pot", owner.Id));
        _ctx.SessionInviteTokens.Add(SessionInviteToken.Create(session.Id, owner.Id));

        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();
        return (owner, group, session);
    }

    [Fact]
    public async Task Deleting_a_session_actually_succeeds_and_takes_its_children_with_it()
    {
        var (owner, _, session) = SeedGroupWithFullSession();

        var handler = new DeleteSessionCommandHandler(_ctx, new FakeCurrentUser(owner.Id, "owner"));
        await handler.Handle(new DeleteSessionCommand(session.Id), CancellationToken.None);

        Assert.Null(await _ctx.Sessions.FirstOrDefaultAsync(s => s.Id == session.Id));
        // The comment in the handler claims these cascade. This is that claim, tested.
        Assert.False(await _ctx.SessionPlayers.AnyAsync(x => x.SessionId == session.Id));
        Assert.False(await _ctx.BuyIns.AnyAsync(x => x.SessionId == session.Id));
        Assert.False(await _ctx.CashOuts.AnyAsync(x => x.SessionId == session.Id));
        Assert.False(await _ctx.Settlements.AnyAsync(x => x.SessionId == session.Id));
        Assert.False(await _ctx.HandRecords.AnyAsync(x => x.SessionId == session.Id));
        Assert.False(await _ctx.SessionInviteTokens.AnyAsync(x => x.SessionId == session.Id));
    }

    [Fact]
    public async Task Deleting_a_session_leaves_the_players_accounts_intact()
    {
        var (owner, _, session) = SeedGroupWithFullSession();

        var handler = new DeleteSessionCommandHandler(_ctx, new FakeCurrentUser(owner.Id, "owner"));
        await handler.Handle(new DeleteSessionCommand(session.Id), CancellationToken.None);

        // Deleting a game must never delete the people who played it.
        Assert.Equal(2, await _ctx.Users.CountAsync());
    }

    [Fact]
    public async Task Deleting_a_group_actually_succeeds_and_takes_its_sessions_with_it()
    {
        var (owner, group, session) = SeedGroupWithFullSession();

        var handler = new DeleteGroupCommandHandler(_ctx, new FakeCurrentUser(owner.Id, "owner"));
        await handler.Handle(new DeleteGroupCommand(group.Id), CancellationToken.None);

        Assert.Null(await _ctx.Groups.FirstOrDefaultAsync(g => g.Id == group.Id));
        Assert.False(await _ctx.GroupMembers.AnyAsync(m => m.GroupId == group.Id));
        // The group→session→money chain is two cascade hops; this is the one most likely to be
        // blocked by a RESTRICT edge someone adds later.
        Assert.Null(await _ctx.Sessions.FirstOrDefaultAsync(s => s.Id == session.Id));
        Assert.False(await _ctx.Settlements.AnyAsync(x => x.SessionId == session.Id));
        Assert.False(await _ctx.BuyIns.AnyAsync(x => x.SessionId == session.Id));
    }

    [Fact]
    public async Task Deleting_a_group_leaves_the_members_accounts_intact()
    {
        var (owner, group, _) = SeedGroupWithFullSession();

        var handler = new DeleteGroupCommandHandler(_ctx, new FakeCurrentUser(owner.Id, "owner"));
        await handler.Handle(new DeleteGroupCommand(group.Id), CancellationToken.None);

        Assert.Equal(2, await _ctx.Users.CountAsync());
    }
}
