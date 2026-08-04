using System.IO;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Sessions.Commands.RemovePlayer;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Tests;

/// <summary>
/// RemovePlayerCommandHandler against a provider that ACTUALLY ENFORCES the
/// BuyIn/CashOut.SessionPlayerId ON DELETE SET NULL cascade (SQLite, not InMemory — see
/// DeleteAccountFkIntegrityTests for why InMemory cannot exercise this class of bug).
///
/// THE RACE (found by the PR #74 disposition fleet, 2026-08-04, live on main today, pre-dates
/// this fix): the original handler read a session's buy-ins/cash-outs into a list, removed THOSE
/// rows, then deleted the SessionPlayer. Any row committed for that seat AFTER the read — a
/// concurrent AddBuyIn from another device at the same table, or (Draft branch) AddBuyIn
/// auto-starting a Draft session mid-removal — was invisible to that list, survived the
/// RemoveRange, and was then orphaned by the seat delete's SET NULL cascade:
/// (SessionPlayerId=null, UserId=null), attributed to no seat and no user. On main the amount is
/// silently dropped from every balance calculation forever; after PR #74's orphaned-money guard
/// it makes the WHOLE session permanently unsettleable, with a refusal message that (falsely, for
/// this shape) implies an account was deleted.
///
/// THE FIX does not try to win the race with locking — it collapses the window instead. Both
/// buy-in and cash-out cleanup now runs as ExecuteDeleteAsync (bypasses the change tracker,
/// queries the LIVE database) as the LAST statement before the seat is removed, so cleanup always
/// reflects whatever is actually in the database at removal time — not a snapshot read earlier in
/// the handler. Applied uniformly to BOTH the Active and Draft branches; the Draft branch
/// previously had NO cleanup at all.
/// </summary>
public sealed class RemovePlayerOrphanRaceTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly AppDbContext _ctx;

    public RemovePlayerOrphanRaceTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        _ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_conn)
            .Options);
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

    private async Task RemoveAsync(Guid callerId, Guid sessionId, Guid sessionPlayerId)
    {
        var handler = new RemovePlayerCommandHandler(_ctx, new FakeCurrentUser(callerId));
        await handler.Handle(new RemovePlayerCommand(sessionId, sessionPlayerId), CancellationToken.None);
    }

    private bool HasOrphanedMoney(Guid sessionId) =>
        _ctx.BuyIns.Any(b => b.SessionId == sessionId && b.SessionPlayerId == null && b.UserId == null)
        || _ctx.CashOuts.Any(c => c.SessionId == sessionId && c.SessionPlayerId == null && c.UserId == null);

    [Fact]
    public async Task Active_session_removal_deletes_every_buyin_and_cashout_for_the_seat_leaving_no_orphan()
    {
        var host = User.Create("host", "host@example.com", "hash");
        _ctx.Users.Add(host);
        var session = Session.Create("Home game", host.Id);
        session.Start();
        _ctx.Sessions.Add(session);

        var guest = SessionPlayer.CreateForGuest(session.Id, "Walk-in Willie");
        _ctx.SessionPlayers.Add(guest);
        _ctx.SaveChanges();

        // Multiple rows, not just one the handler "already knew about" — the fix must not assume
        // a single row or a list captured earlier. This is what a concurrently-committed buy-in
        // (invisible to a stale snapshot) looks like from the database's point of view: just
        // another row that exists by the time cleanup actually runs.
        _ctx.BuyIns.Add(BuyIn.Create(session.Id, guest.Id, 50m));
        _ctx.BuyIns.Add(BuyIn.Create(session.Id, guest.Id, 20m));
        _ctx.CashOuts.Add(CashOut.Create(session.Id, guest.Id, 10m));
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await RemoveAsync(host.Id, session.Id, guest.Id);

        Assert.Null(await _ctx.SessionPlayers.FirstOrDefaultAsync(sp => sp.Id == guest.Id));
        Assert.Equal(0, await _ctx.BuyIns.CountAsync(b => b.SessionPlayerId == guest.Id));
        Assert.Equal(0, await _ctx.CashOuts.CountAsync(c => c.SessionPlayerId == guest.Id));
        // The money-critical assertion: gone, not orphaned. A SET-NULL survivor here is exactly
        // the shape that PR #74's CalculateSettlements guard would otherwise refuse forever.
        Assert.False(HasOrphanedMoney(session.Id));
    }

    [Fact]
    public async Task Draft_session_removal_now_cleans_up_money_rows_the_original_code_never_touched()
    {
        // The Draft branch's own bug, independent of any Active-branch race: the ORIGINAL handler
        // had zero money-row cleanup on this path — any player type, any money already attached.
        // In production this combination (a Draft-status session with a buy-in already on a seat)
        // is exactly what AddBuyIn's auto-start race produces: AddBuyInCommandHandler starts the
        // session AND writes the buy-in in one commit; RemovePlayerCommandHandler, having read the
        // session moments earlier, still sees Draft. Seeded directly here — the handler's behavior
        // for "Draft status, a seat with money on it" does not depend on how that state arose.
        var host = User.Create("host", "host@example.com", "hash");
        var registered = User.Create("registered", "registered@example.com", "hash");
        _ctx.Users.AddRange(host, registered);
        var session = Session.Create("Home game", host.Id); // Draft — Session.Create's default
        _ctx.Sessions.Add(session);

        var player = SessionPlayer.CreateForUser(session.Id, registered.Id);
        _ctx.SessionPlayers.Add(player);
        _ctx.SaveChanges();

        _ctx.BuyIns.Add(BuyIn.Create(session.Id, player.Id, 100m));
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        Assert.Equal(SessionStatus.Draft, (await _ctx.Sessions.FirstAsync(s => s.Id == session.Id)).Status);

        await RemoveAsync(host.Id, session.Id, player.Id);

        Assert.Null(await _ctx.SessionPlayers.FirstOrDefaultAsync(sp => sp.Id == player.Id));
        Assert.Equal(0, await _ctx.BuyIns.CountAsync(b => b.SessionPlayerId == player.Id));
        Assert.False(HasOrphanedMoney(session.Id));
    }

    [Fact]
    public async Task Removing_a_guest_with_no_money_from_an_active_session_still_works()
    {
        // Baseline regression: the common case (no race, no money at all) must be unaffected by
        // the ExecuteDeleteAsync rewrite.
        var host = User.Create("host", "host@example.com", "hash");
        _ctx.Users.Add(host);
        var session = Session.Create("Home game", host.Id);
        session.Start();
        _ctx.Sessions.Add(session);
        var guest = SessionPlayer.CreateForGuest(session.Id, "Walk-in Willie");
        _ctx.SessionPlayers.Add(guest);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await RemoveAsync(host.Id, session.Id, guest.Id);

        Assert.Null(await _ctx.SessionPlayers.FirstOrDefaultAsync(sp => sp.Id == guest.Id));
    }

    [Fact]
    public async Task Registered_players_still_cannot_be_removed_from_an_active_session()
    {
        // Pre-existing business rule, unchanged by the rewrite.
        var host = User.Create("host", "host@example.com", "hash");
        var registered = User.Create("registered", "registered@example.com", "hash");
        _ctx.Users.AddRange(host, registered);
        var session = Session.Create("Home game", host.Id);
        session.Start();
        _ctx.Sessions.Add(session);
        var player = SessionPlayer.CreateForUser(session.Id, registered.Id);
        _ctx.SessionPlayers.Add(player);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await Assert.ThrowsAsync<ConflictException>(() => RemoveAsync(host.Id, session.Id, player.Id));

        Assert.NotNull(await _ctx.SessionPlayers.FirstOrDefaultAsync(sp => sp.Id == player.Id));
    }

    [Fact]
    public async Task Players_cannot_be_removed_from_a_finished_session()
    {
        // Pre-existing business rule, unchanged by the rewrite.
        var host = User.Create("host", "host@example.com", "hash");
        _ctx.Users.Add(host);
        var session = Session.Create("Home game", host.Id);
        session.Start();
        session.End();
        _ctx.Sessions.Add(session);
        var guest = SessionPlayer.CreateForGuest(session.Id, "Walk-in Willie");
        _ctx.SessionPlayers.Add(guest);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await Assert.ThrowsAsync<ConflictException>(() => RemoveAsync(host.Id, session.Id, guest.Id));
    }

    [Fact]
    public void The_handler_cleans_up_money_for_BOTH_branches_via_ONE_shared_unconditional_block()
    {
        // Structural pin. The behavioral tests can't by themselves rule out a future regression
        // where the Draft branch's cleanup is duplicated back into a per-branch `if`, silently
        // reintroducing the exact gap this fix closes (Draft had none at all) the next time
        // someone "simplifies" this method. Anchored on POSITION, not just presence: the
        // BuyIns/CashOuts cleanup must appear strictly AFTER the two ConflictException guard
        // clauses (i.e., not nested inside either), so it runs unconditionally for whichever
        // branch was allowed through.
        var path = Path.Combine(FindRepoRoot(), "src", "PokerApp.Application", "Features", "Sessions",
            "Commands", "RemovePlayer", "RemovePlayerCommandHandler.cs");
        var src = File.ReadAllText(path);

        var lastGuardIndex = src.IndexOf(
            "Players can only be removed from Draft or Active sessions.", StringComparison.Ordinal);
        var cleanupIndex = src.IndexOf("var buyIns", StringComparison.Ordinal);

        Assert.True(lastGuardIndex > 0, "Expected the Draft/Active guard clause message in the handler.");
        Assert.True(cleanupIndex > 0, "Expected a 'var buyIns' cleanup read in the handler.");
        Assert.True(cleanupIndex > lastGuardIndex,
            "Expected the BuyIns/CashOuts cleanup to run AFTER both guard clauses, not nested inside either.");
        // Position alone doesn't catch RE-nesting the cleanup one level deeper (still textually
        // after the guards, but inside a NEW `if (session.Status == Active)` wrapping it back to
        // Active-only) — the exact shape that survived the ordering check above when probed.
        // session.Status == appears exactly once in the fixed handler (the first guard clause); a
        // second occurrence between the guards and the cleanup is that reintroduced conditional.
        var between = src[lastGuardIndex..cleanupIndex];
        Assert.DoesNotContain("session.Status ==", between);

        // Exactly one BuyIns removal and one CashOuts removal — not duplicated per-branch (which
        // is the shape of the regression this pin exists to catch: cleanup copy-pasted back into
        // separate Active/Draft blocks would show up as FOUR RemoveRange calls, or as the Draft
        // branch's block containing none).
        Assert.Single(System.Text.RegularExpressions.Regex.Matches(src, @"BuyIns\.RemoveRange"));
        Assert.Single(System.Text.RegularExpressions.Regex.Matches(src, @"CashOuts\.RemoveRange"));
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "PokerApp.sln")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Repo root (PokerApp.sln) not found.");
    }
}
