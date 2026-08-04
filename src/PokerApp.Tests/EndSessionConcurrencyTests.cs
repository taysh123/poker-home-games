using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Sessions.Commands.AddBuyIn;
using PokerApp.Application.Features.Sessions.Commands.EndSession;
using PokerApp.Application.Features.Sessions.Commands.JoinSessionByToken;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Tests;

/// <summary>
/// The read-check-then-mutate (TOCTOU) contract for the two session state transitions that money
/// depends on (audit 2026-08-03: HIGH #3 for EndSession, MEDIUM for invite-token redemption —
/// the audit names them the same class).
///
/// EndSession reads `session.Status`, checks it is Active, then inserts a full `FinalStacks` set
/// of CashOut rows. Two "End Game &amp; Settle" submits in flight at once — two admins, or a client
/// retrying after a timeout while the first request is still running — BOTH pass that guard and
/// BOTH insert cash-outs. `CalculateSettlements` and the balance projections sum every CashOut row
/// per seat with no dedupe, so the duplicate directly DOUBLES a player's counted cash-out.
/// JoinSessionByToken has the identical shape one row over: both racers read `UsedAt IS NULL` on a
/// SINGLE-USE token and both consume it.
///
/// ONE mechanism closes both: an optimistic concurrency token on the row each handler mutates
/// (`Session` for the end, `SessionInviteToken` for the redemption). The losing writer's UPDATE
/// matches zero rows, EF throws `DbUpdateConcurrencyException`, and — because SaveChanges is one
/// transaction — its inserted CashOut rows roll back with it. The handler translates that to a
/// ConflictException (409).
///
/// SQLite, not InMemory: these assertions are about real relational UPDATE-with-WHERE behaviour
/// and rows-affected, which the InMemory provider does not model. Each simulated request gets its
/// OWN DbContext over the SAME database, exactly as two concurrent HTTP requests do (the context
/// is request-scoped) — a single context would resolve the race in the change tracker and prove
/// nothing.
/// </summary>
public sealed class EndSessionConcurrencyTests : IDisposable
{
    private readonly SqliteConnection _conn;

    public EndSessionConcurrencyTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        using var ctx = NewContext();
        ctx.Database.EnsureCreated();
    }

    public void Dispose() => _conn.Dispose();

    private AppDbContext NewContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options);

    private sealed class FakeCurrentUser(Guid id) : ICurrentUserService
    {
        public Guid UserId { get; } = id;
        public string? Email => "host@example.com";
        public string? Username => "host";
        public bool IsAuthenticated => true;
    }

    private sealed class NoAchievements : IAchievementEvaluator
    {
        public Task<IReadOnlyList<string>> EvaluateAsync(Guid userId, Guid sessionId, CancellationToken ct)
            => Task.FromResult<IReadOnlyList<string>>([]);
    }

    private sealed class NoNotifications : INotificationService
    {
        public Task NotifyAsync(Guid userId, NotificationType type, string title, string body,
            Guid? relatedEntityId = null, CancellationToken ct = default) => Task.CompletedTask;

        public Task NotifyManyAsync(IEnumerable<Guid> userIds, NotificationType type, string title,
            string body, Guid? relatedEntityId = null, CancellationToken ct = default) => Task.CompletedTask;
    }

    private static Task EndAsync(AppDbContext ctx, Guid callerId, Guid sessionId, params FinalStackItem[] stacks) =>
        new EndSessionCommandHandler(ctx, new FakeCurrentUser(callerId), new NoAchievements(), new NoNotifications())
            .Handle(new EndSessionCommand(sessionId, stacks), CancellationToken.None);

    private static Task BuyInAsync(AppDbContext ctx, Guid callerId, Guid sessionId, Guid seatId, decimal amount) =>
        new AddBuyInCommandHandler(ctx, new FakeCurrentUser(callerId))
            .Handle(new AddBuyInCommand(sessionId, seatId, amount), CancellationToken.None);

    private static Task JoinAsync(AppDbContext ctx, Guid callerId, string token) =>
        new JoinSessionByTokenCommandHandler(ctx, new FakeCurrentUser(callerId))
            .Handle(new JoinSessionByTokenCommand(token), CancellationToken.None);

    /// <summary>A standalone Active session (creator == host, so no group membership needed) with one seated guest.</summary>
    private (Guid HostId, Guid SessionId, Guid SeatId) SeedActiveSessionWithOneSeat()
    {
        using var ctx = NewContext();
        var host = User.Create("host", "host@example.com", "hash");
        ctx.Users.Add(host);
        var session = Session.Create("Friday night", host.Id);
        session.Start();
        ctx.Sessions.Add(session);
        var seat = SessionPlayer.CreateForGuest(session.Id, "Walk-in Willie");
        ctx.SessionPlayers.Add(seat);
        ctx.BuyIns.Add(BuyIn.Create(session.Id, seat.Id, 100m));
        ctx.SaveChanges();
        return (host.Id, session.Id, seat.Id);
    }

    [Fact]
    public async Task Two_racing_end_game_submits_cannot_both_record_a_cash_out()
    {
        var seed = SeedActiveSessionWithOneSeat();

        using var slow = NewContext();   // request B — reads early, commits late
        using var fast = NewContext();   // request A — wins the race

        // B's READ, before A commits: this is the TOCTOU window opening. B is now holding a
        // Session it believes is Active. B's handler will re-query, but EF returns the instance B
        // already tracks (a later query does not overwrite a tracked entity's values), so B reaches
        // the cash-out insert exactly as a genuinely concurrent request does. The status guard is
        // NOT what stops B here — that is the whole point, and why a sequential double-end test
        // (below) cannot stand in for this one.
        await slow.Sessions.FirstAsync(s => s.Id == seed.SessionId);

        await EndAsync(fast, seed.HostId, seed.SessionId, new FinalStackItem(seed.SeatId, 250m));

        await Assert.ThrowsAsync<ConflictException>(() =>
            EndAsync(slow, seed.HostId, seed.SessionId, new FinalStackItem(seed.SeatId, 250m)));

        // THE MONEY ASSERTION. A second row here is a doubled cash-out in every settlement
        // projection, which is the corruption this slice exists to prevent — and it must be
        // absent because the losing SaveChanges rolled ITS OWN inserts back, not because the
        // handler happened to throw before inserting.
        using var check = NewContext();
        Assert.Equal(1, await check.CashOuts.CountAsync(c => c.SessionPlayerId == seed.SeatId));
        // Summed client-side: SQLite cannot apply Sum to a decimal server-side.
        var amounts = await check.CashOuts.Where(c => c.SessionPlayerId == seed.SeatId)
            .Select(c => c.Amount).ToListAsync();
        Assert.Equal(250m, amounts.Sum());
    }

    [Fact]
    public async Task Two_racing_redemptions_cannot_both_consume_a_single_use_invite_token()
    {
        // Same mechanism, one row over: the token, not the session, is what this handler mutates.
        // "Single-use" is the token's stated guarantee (`IsActive` requires `UsedAt` to be null);
        // without a concurrency token that guarantee is only as good as the gap between the read
        // and the write. The unique index on SessionPlayers(SessionId, UserId) does NOT cover this
        // — the racers are two DIFFERENT users, so both inserts are perfectly legal rows.
        var seed = SeedActiveSessionWithOneSeat();
        Guid alice, bob;
        string token;
        using (var ctx = NewContext())
        {
            var a = User.Create("alice", "alice@example.com", "hash");
            var b = User.Create("bob", "bob@example.com", "hash");
            ctx.Users.AddRange(a, b);
            var invite = SessionInviteToken.Create(seed.SessionId, seed.HostId);
            ctx.SessionInviteTokens.Add(invite);
            ctx.SaveChanges();
            (alice, bob, token) = (a.Id, b.Id, invite.Token);
        }

        using var slow = NewContext();
        using var fast = NewContext();

        await slow.SessionInviteTokens.Include(t => t.Session).FirstAsync(t => t.Token == token);

        await JoinAsync(fast, alice, token);

        await Assert.ThrowsAsync<ConflictException>(() => JoinAsync(slow, bob, token));

        using var check = NewContext();
        Assert.Equal(1, await check.SessionPlayers.CountAsync(sp => sp.SessionId == seed.SessionId && sp.UserId != null));
        Assert.True(await check.SessionPlayers.AnyAsync(sp => sp.SessionId == seed.SessionId && sp.UserId == alice));
        Assert.False(await check.SessionPlayers.AnyAsync(sp => sp.SessionId == seed.SessionId && sp.UserId == bob));
    }

    [Fact]
    public async Task Two_concurrent_first_buyins_on_a_draft_session_both_record()
    {
        // REGRESSION PIN, and the reason only End() advances the token. AddBuyIn auto-starts a
        // Draft session as a side effect of the first buy-in (`if (Draft) session.Start()`), so an
        // earlier draft of this slice — which bumped the token in Start() too — turned two
        // concurrent FIRST buy-ins into a race: the loser's UPDATE matched zero rows and, because
        // SaveChanges is one transaction, its BUY-IN ROW ROLLED BACK WITH IT. Real money, silently
        // dropped, on the live-session critical path, reported to the host as a vague "changed by
        // someone else" (found against real PostgreSQL by the T0.2 review fleet).
        //
        // Nothing about starting a session needs serialising: both racers want the same end state
        // and neither decision depends on winning. Ending does. Both buy-ins must land.
        var host = User.Create("host", "host@example.com", "hash");
        Guid sessionId, seatA, seatB;
        using (var ctx = NewContext())
        {
            ctx.Users.Add(host);
            var session = Session.Create("Friday night", host.Id);   // Draft — not started
            ctx.Sessions.Add(session);
            var a = SessionPlayer.CreateForGuest(session.Id, "Guest A");
            var b = SessionPlayer.CreateForGuest(session.Id, "Guest B");
            ctx.SessionPlayers.AddRange(a, b);
            ctx.SaveChanges();
            (sessionId, seatA, seatB) = (session.Id, a.Id, b.Id);
        }

        using var slow = NewContext();
        using var fast = NewContext();

        // Both requests read the session while it is still Draft, so both will auto-start it.
        await slow.Sessions.FirstAsync(s => s.Id == sessionId);

        await BuyInAsync(fast, host.Id, sessionId, seatA, 100m);
        await BuyInAsync(slow, host.Id, sessionId, seatB, 100m);   // must NOT throw

        using var check = NewContext();
        Assert.Equal(2, await check.BuyIns.CountAsync(b => b.SessionId == sessionId));
        Assert.Equal(SessionStatus.Active, (await check.Sessions.FirstAsync(s => s.Id == sessionId)).Status);
    }

    [Fact]
    public async Task An_uncontended_end_still_succeeds_and_records_its_cash_outs()
    {
        // The guard must not cost the normal path anything: one request, no racer, no conflict.
        // A concurrency token that rejects uncontended writes would break every game night.
        var seed = SeedActiveSessionWithOneSeat();

        using var ctx = NewContext();
        await EndAsync(ctx, seed.HostId, seed.SessionId, new FinalStackItem(seed.SeatId, 175m));

        using var check = NewContext();
        var session = await check.Sessions.FirstAsync(s => s.Id == seed.SessionId);
        Assert.Equal(SessionStatus.Finished, session.Status);
        Assert.Equal(1, await check.CashOuts.CountAsync(c => c.SessionPlayerId == seed.SeatId));
    }

    [Fact]
    public async Task An_uncontended_redemption_still_seats_the_player()
    {
        var seed = SeedActiveSessionWithOneSeat();
        Guid alice;
        string token;
        using (var ctx = NewContext())
        {
            var a = User.Create("alice", "alice@example.com", "hash");
            ctx.Users.Add(a);
            var invite = SessionInviteToken.Create(seed.SessionId, seed.HostId);
            ctx.SessionInviteTokens.Add(invite);
            ctx.SaveChanges();
            (alice, token) = (a.Id, invite.Token);
        }

        using var ctx2 = NewContext();
        await JoinAsync(ctx2, alice, token);

        using var check = NewContext();
        Assert.True(await check.SessionPlayers.AnyAsync(sp => sp.SessionId == seed.SessionId && sp.UserId == alice));
        Assert.False((await check.SessionInviteTokens.FirstAsync(t => t.Token == token)).IsActive);
    }

    [Fact]
    public async Task A_sequential_second_end_is_still_refused_by_the_status_guard()
    {
        // Pre-existing behaviour, and deliberately NOT the same test as the race above: here the
        // second caller reads the session AFTER the first commit, so it sees Finished and the
        // plain status check refuses it. This is the case that already worked; it is pinned so a
        // future change to the guard cannot silently remove it while the concurrency token masks
        // the loss.
        var seed = SeedActiveSessionWithOneSeat();

        using var first = NewContext();
        await EndAsync(first, seed.HostId, seed.SessionId, new FinalStackItem(seed.SeatId, 100m));

        using var second = NewContext();
        await Assert.ThrowsAsync<ConflictException>(() =>
            EndAsync(second, seed.HostId, seed.SessionId, new FinalStackItem(seed.SeatId, 100m)));

        using var check = NewContext();
        Assert.Equal(1, await check.CashOuts.CountAsync(c => c.SessionPlayerId == seed.SeatId));
    }
}
