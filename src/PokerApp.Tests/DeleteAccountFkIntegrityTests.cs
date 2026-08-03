using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Auth.Commands.DeleteAccount;
using PokerApp.Application.Features.Settlements.Commands.CalculateSettlements;
using PokerApp.Application.Services;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Tests;

/// <summary>
/// Account deletion against a provider that ACTUALLY ENFORCES FOREIGN KEYS.
///
/// Why SQLite and not the repo's usual TestInfra.NewContext(): the InMemory provider does not
/// enforce referential integrity at all, so a delete test written against it passes green while
/// the real Postgres database rejects the same delete. That is not a hypothetical — the defect
/// this file exists to pin (account deletion 500s for any user with settlement history) was live
/// on a shipped App Store build, and an InMemory test would have "covered" it while proving
/// nothing. A guard that cannot fail is worse than no guard, because it reads as coverage.
///
/// HONEST LIMIT: SQLite is not Postgres. What transfers is the FK topology and the
/// RESTRICT-blocks-delete semantics generated from the same EF model, which is exactly the class
/// of bug here. Postgres-specific behaviour (types, collations, triggers) is NOT covered.
///
/// Apple requires working in-app account deletion (App Store Review Guideline 5.1.1(v)), and the
/// Danger Zone confirm copy (ProfileScreen.tsx:171) reads, verbatim: "This will permanently delete
/// your account and all associated data. This cannot be undone." So a failing delete is a
/// compliance defect, not only a bug. (An earlier draft quoted a paraphrase of that line as if it
/// were the literal — pin literals, including when quoting your own product.)
/// </summary>
public sealed class DeleteAccountFkIntegrityTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly AppDbContext _ctx;

    public DeleteAccountFkIntegrityTests()
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
        public string? Email => "leaving@example.com";
        public string? Username => "leaving";
        public bool IsAuthenticated => true;
    }

    /// <summary>
    /// The FK graph that actually exists in production. Every relationship seeded here is a
    /// RESTRICT foreign key pointing at Users — i.e. one that BLOCKS the delete unless the handler
    /// clears it first. Derived from the EF model snapshot, not from assumption.
    /// </summary>
    private sealed record Seeded(
        User Leaving, User Other, Session Session,
        Guid LeavingPlayerId, Guid BuyInId, Guid CashOutId, int PlayerCount);

    private Seeded SeedFullGraph()
    {
        var leaving = User.Create("leaving", "leaving@example.com", "hash");
        var other = User.Create("other", "other@example.com", "hash");
        _ctx.Users.AddRange(leaving, other);

        // The OTHER user owns the group — the handler deliberately blocks deletion for owners,
        // so an owned group would mask every other FK by short-circuiting first.
        var group = Group.Create("Thursday Game", null, other.Id);
        _ctx.Groups.Add(group);
        _ctx.GroupMembers.Add(GroupMember.Create(group.Id, leaving.Id, GroupRole.Member));
        _ctx.GroupMembers.Add(GroupMember.Create(group.Id, other.Id, GroupRole.Owner));

        var session = Session.Create("Session 1", other.Id, group.Id);
        _ctx.Sessions.Add(session);

        var spLeaving = SessionPlayer.CreateForUser(session.Id, leaving.Id);
        var spOther = SessionPlayer.CreateForUser(session.Id, other.Id);
        // A GUEST row linked to the leaving user: SessionPlayer.LinkedUserId is a RESTRICT FK and
        // is a separate blocker from SessionPlayer.UserId, which the handler already anonymises.
        var spGuestLinked = SessionPlayer.CreateForGuest(session.Id, "Dan (guest)", leaving.Id);
        _ctx.SessionPlayers.AddRange(spLeaving, spOther, spGuestLinked);

        // BuyIn.UserId / CashOut.UserId are nullable RESTRICT FKs that the CURRENT factories never
        // populate — but legacy rows written before SessionPlayerId existed still carry them, and
        // the constraint blocks the delete regardless of how the row was created. Seeded through
        // the change tracker precisely because no factory can produce this shape any more.
        var buyIn = BuyIn.Create(session.Id, spLeaving.Id, 100m);
        _ctx.BuyIns.Add(buyIn);
        _ctx.Entry(buyIn).Property("UserId").CurrentValue = leaving.Id;

        var cashOut = CashOut.Create(session.Id, spLeaving.Id, 60m);
        _ctx.CashOuts.Add(cashOut);
        _ctx.Entry(cashOut).Property("UserId").CurrentValue = leaving.Id;

        // The blocker from the audit: settlements name both parties with required RESTRICT FKs.
        // BOTH directions are seeded. Seeding only the payer side left the handler's
        // `|| s.ReceiverUserId == userId` clause vacuously "covered" — the OR'd assertion read as
        // coverage while no row could ever satisfy its second half. In a home game the receiver is
        // the winner, so the untested half was the more common production case.
        _ctx.Settlements.Add(Settlement.Create(session.Id, leaving.Id, other.Id, 40m));
        _ctx.Settlements.Add(Settlement.Create(session.Id, other.Id, leaving.Id, 25m));

        // An invitation the leaving user SENT (InvitedByUserId is RESTRICT and required).
        var third = User.Create("third", "third@example.com", "hash");
        _ctx.Users.Add(third);
        _ctx.GroupInvitations.Add(GroupInvitation.Create(group.Id, leaving.Id, third.Id));

        _ctx.SaveChanges();
        var playerCount = _ctx.SessionPlayers.Count(sp => sp.SessionId == session.Id);
        _ctx.ChangeTracker.Clear();
        return new Seeded(leaving, other, session, spLeaving.Id, buyIn.Id, cashOut.Id, playerCount);
    }

    private async Task DeleteAsync(Guid userId)
    {
        var handler = new DeleteAccountCommandHandler(_ctx, new FakeCurrentUser(userId));
        await handler.Handle(new DeleteAccountCommand(), CancellationToken.None);
    }

    [Fact]
    public async Task Deletion_succeeds_for_a_user_with_the_full_production_FK_graph()
    {
        var s = SeedFullGraph();

        // The whole point: this must not throw. Before the fix it threw DbUpdateException on
        // SaveChanges (FK violation), which ExceptionHandlingMiddleware does not map — so the live
        // app returned a bare 500 whose body is the generic "An unexpected error occurred" shape
        // with a trace id, for exactly the users engaged enough to have settlements.
        await DeleteAsync(s.Leaving.Id);

        Assert.Null(await _ctx.Users.FirstOrDefaultAsync(u => u.Id == s.Leaving.Id));
    }

    [Fact]
    public async Task Deletion_does_not_destroy_the_other_players_session_history()
    {
        var s = SeedFullGraph();

        await DeleteAsync(s.Leaving.Id);

        // The group, the session and the remaining player's row belong to people who did NOT ask
        // to be forgotten. Erasing one account must not erase their books.
        Assert.NotNull(await _ctx.Sessions.FirstOrDefaultAsync(x => x.Id == s.Session.Id));
        Assert.NotNull(await _ctx.Users.FirstOrDefaultAsync(u => u.Id == s.Other.Id));
        Assert.True(await _ctx.SessionPlayers.AnyAsync(sp => sp.UserId == s.Other.Id));
    }

    [Fact]
    public async Task Deletion_clears_every_seeded_restrict_reference_to_the_user()
    {
        var s = SeedFullGraph();

        await DeleteAsync(s.Leaving.Id);

        // Each assertion is one RESTRICT FK from the model snapshot, in BOTH directions where the
        // relationship has two (settlements). Scope, stated because an earlier version of this
        // comment overclaimed: this test catches a NEW RESTRICT FK only if SeedFullGraph is also
        // extended to write a row on that edge. The structural guarantee — that a new edge is
        // noticed at all — is Restrict_foreign_keys_to_User_match_the_acknowledged_set below.
        Assert.False(await _ctx.SessionPlayers.AnyAsync(sp => sp.UserId == s.Leaving.Id));
        Assert.False(await _ctx.SessionPlayers.AnyAsync(sp => sp.LinkedUserId == s.Leaving.Id));
        Assert.False(await _ctx.BuyIns.AnyAsync(b => b.UserId == s.Leaving.Id));
        Assert.False(await _ctx.CashOuts.AnyAsync(c => c.UserId == s.Leaving.Id));
        Assert.False(await _ctx.Settlements.AnyAsync(x => x.PayerUserId == s.Leaving.Id));
        Assert.False(await _ctx.Settlements.AnyAsync(x => x.ReceiverUserId == s.Leaving.Id));
        Assert.False(await _ctx.GroupInvitations.AnyAsync(i => i.InvitedByUserId == s.Leaving.Id));
        // Groups.OwnerId is the eighth RESTRICT relationship (an earlier version of this comment
        // said "sixth", a leftover from the five-column count corrected in 096ac93). It is
        // discharged by the ownership precondition rather than cleared here; asserted so the
        // test's name is honest.
        Assert.False(await _ctx.Groups.AnyAsync(g => g.OwnerId == s.Leaving.Id));
    }

    [Fact]
    public async Task The_leavers_own_money_rows_are_ANONYMISED_not_deleted()
    {
        // The commit's central product decision, which the first version of these tests could not
        // distinguish from deletion: every retention assertion was `Assert.False(Any(UserId == x))`,
        // which is satisfied just as well by "row deleted". Mutation-verified: deleting the rows
        // instead of anonymising them kept the whole suite green. These assertions are positive.
        var s = SeedFullGraph();

        await DeleteAsync(s.Leaving.Id);

        var buyIn = await _ctx.BuyIns.FirstOrDefaultAsync(b => b.Id == s.BuyInId);
        Assert.NotNull(buyIn);
        Assert.Null(buyIn!.UserId);
        Assert.Equal(100m, buyIn.Amount);          // the money is the point — it must be untouched
        Assert.NotNull(buyIn.SessionPlayerId);     // still attributable to a seat at the table

        var cashOut = await _ctx.CashOuts.FirstOrDefaultAsync(c => c.Id == s.CashOutId);
        Assert.NotNull(cashOut);
        Assert.Null(cashOut!.UserId);
        Assert.Equal(60m, cashOut.Amount);

        var player = await _ctx.SessionPlayers.FirstOrDefaultAsync(sp => sp.Id == s.LeavingPlayerId);
        Assert.NotNull(player);
        Assert.Null(player!.UserId);

        // If any participant row were dropped the session would stop reconciling for everyone else.
        Assert.Equal(s.PlayerCount, await _ctx.SessionPlayers.CountAsync(sp => sp.SessionId == s.Session.Id));
    }

    [Fact]
    public async Task The_anonymised_guest_row_survives_so_the_session_still_balances()
    {
        var s = SeedFullGraph();
        var session = s.Session;
        await DeleteAsync(s.Leaving.Id);

        // A guest row linked to the leaving user represents a real person at a real table. Clearing
        // the LINK must not delete the player, or the session's participant list silently shrinks
        // and the other players' totals stop reconciling.
        var guest = await _ctx.SessionPlayers
            .FirstOrDefaultAsync(sp => sp.SessionId == session.Id && sp.GuestName == "Dan (guest)");
        Assert.NotNull(guest);
        Assert.Null(guest!.LinkedUserId);
    }

    [Fact]
    public async Task Recalculating_after_a_deletion_cannot_destroy_the_survivors_settlements()
    {
        // The cross-user data loss this fix would otherwise have INTRODUCED: recalculating after
        // a deletion fabricates a wrong settlement set from an unbalanced pool and deletes the
        // survivors' correct rows on the way.
        //
        // TRIGGER, corrected after review: with a surviving settlement present (as seeded here)
        // SessionScreen does NOT auto-call — the auto-call fires only when the saved list came
        // back EMPTY — so this state is reached via the manual Recalculate control, or via the
        // auto-call after a failed settlements GET. An earlier version of this comment claimed
        // the receivable is "destroyed with no user action, on next open"; it cannot be — the
        // auto-call and a surviving settlement are mutually exclusive.
        //
        // Revert-test: removing the hasDeletedPlayer guard turns this red ("no exception was
        // thrown") and turns the companion tests below red on the destroyed row itself.
        var s = SeedFullGraph();

        // A third player who is NOT deleted, owed money by someone who also is not deleted, so the
        // surviving debt has nothing to do with the departing user.
        var payer = User.Create("payer", "payer@example.com", "hash");
        _ctx.Users.Add(payer);
        _ctx.SessionPlayers.Add(SessionPlayer.CreateForUser(s.Session.Id, payer.Id));
        var survivingDebt = Settlement.Create(s.Session.Id, payer.Id, s.Other.Id, 15m);
        _ctx.Settlements.Add(survivingDebt);
        // Only a FINISHED session is recalculable, and it is the state the auto-call fires in.
        var seeded = _ctx.Sessions.First(x => x.Id == s.Session.Id);
        seeded.Start();
        seeded.End();
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await DeleteAsync(s.Leaving.Id);

        // Finished, with an anonymised player present — exactly the auto-recalc state.
        var session = await _ctx.Sessions.FirstAsync(x => x.Id == s.Session.Id);
        Assert.Equal(SessionStatus.Finished, session.Status);
        Assert.True(await _ctx.SessionPlayers.AnyAsync(sp =>
            sp.SessionId == s.Session.Id && sp.UserId == null && sp.LinkedUserId == null && sp.GuestName == null));

        var calc = new CalculateSettlementsCommandHandler(
            _ctx, new FakeCurrentUser(s.Other.Id), new SettlementCalculatorService());

        // The MESSAGE is asserted, not only the type: a type-only assertion stayed green under a
        // mutant that removed the guard and threw an unrelated BadRequest from another
        // precondition. The substring is the stable clause of the guard's copy.
        var ex = await Assert.ThrowsAsync<Application.Common.Exceptions.BadRequestException>(
            () => calc.Handle(new CalculateSettlementsCommand(s.Session.Id), CancellationToken.None));
        Assert.Contains("account was deleted", ex.Message);

        // The surviving player's money is still there, untouched, with its original amount.
        var still = await _ctx.Settlements.FirstOrDefaultAsync(x => x.Id == survivingDebt.Id);
        Assert.NotNull(still);
        Assert.Equal(15m, still!.Amount);
    }

    /// <summary>
    /// The SECOND shape account deletion leaves behind: the departing user sat at the table ONLY
    /// through a guest row linked to their account. UnlinkUser() clears the link but KEEPS
    /// GuestName — deliberately, see The_anonymised_guest_row_survives_so_the_session_still_balances
    /// — so after deletion the row is indistinguishable by shape from an ordinary walk-in guest.
    /// The fact must therefore be recorded at deletion time (SessionPlayer.AccountDeletedAt);
    /// no predicate over the surviving columns can recover it.
    /// </summary>
    private (Guid LeavingId, Guid OtherId, Guid SessionId, Guid SurvivingDebtId) SeedLinkedGuestOnlyScenario()
    {
        var leaving = User.Create("leaving", "leaving@example.com", "hash");
        var other = User.Create("other", "other@example.com", "hash");
        var payer = User.Create("payer", "payer@example.com", "hash");
        _ctx.Users.AddRange(leaving, other, payer);

        var group = Group.Create("Thursday Game", null, other.Id);
        _ctx.Groups.Add(group);
        _ctx.GroupMembers.Add(GroupMember.Create(group.Id, other.Id, GroupRole.Owner));

        var session = Session.Create("Session 1", other.Id, group.Id);
        session.Start();
        session.End();
        _ctx.Sessions.Add(session);

        // The departing user has NO own SessionPlayer row. In SeedFullGraph the linked guest sits
        // next to the leaver's own row, whose anonymised all-null shape trips the guard first —
        // so the guest shape was never exercised against the guard until this seed isolated it.
        _ctx.SessionPlayers.Add(SessionPlayer.CreateForGuest(session.Id, "Dan (guest)", leaving.Id));
        _ctx.SessionPlayers.Add(SessionPlayer.CreateForUser(session.Id, other.Id));
        _ctx.SessionPlayers.Add(SessionPlayer.CreateForUser(session.Id, payer.Id));

        // One settlement names the departing user (deletion removes it), one is between two
        // SURVIVORS and has nothing to do with the leaver — the row the guard exists to protect.
        _ctx.Settlements.Add(Settlement.Create(session.Id, leaving.Id, other.Id, 40m));
        var survivingDebt = Settlement.Create(session.Id, payer.Id, other.Id, 15m);
        _ctx.Settlements.Add(survivingDebt);

        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();
        return (leaving.Id, other.Id, session.Id, survivingDebt.Id);
    }

    [Fact]
    public async Task Recalculation_is_refused_when_the_deleted_account_sat_as_a_linked_guest()
    {
        var s = SeedLinkedGuestOnlyScenario();

        await DeleteAsync(s.LeavingId);

        // Isolation pin: the anonymised all-null shape is ABSENT. If this ever fails, the seed
        // has drifted back into the shape the original guard already caught, and the test would
        // pass without exercising the linked-guest branch at all.
        Assert.False(await _ctx.SessionPlayers.AnyAsync(sp =>
            sp.SessionId == s.SessionId && sp.UserId == null && sp.LinkedUserId == null && sp.GuestName == null));

        var calc = new CalculateSettlementsCommandHandler(
            _ctx, new FakeCurrentUser(s.OtherId), new SettlementCalculatorService());

        var ex = await Assert.ThrowsAsync<Application.Common.Exceptions.BadRequestException>(
            () => calc.Handle(new CalculateSettlementsCommand(s.SessionId), CancellationToken.None));
        Assert.Contains("account was deleted", ex.Message);
    }

    [Fact]
    public async Task A_recalculation_attempt_after_a_linked_guest_deletion_cannot_destroy_the_survivors_settlement()
    {
        // The non-vacuous companion to the refusal test above: swallow the refusal and assert the
        // MONEY. Reverting the guard makes this fail because the survivors' row is genuinely
        // destroyed — red for the reason the guard exists, not because an exception type changed.
        var s = SeedLinkedGuestOnlyScenario();
        await DeleteAsync(s.LeavingId);

        var calc = new CalculateSettlementsCommandHandler(
            _ctx, new FakeCurrentUser(s.OtherId), new SettlementCalculatorService());
        try
        {
            await calc.Handle(new CalculateSettlementsCommand(s.SessionId), CancellationToken.None);
        }
        catch (Application.Common.Exceptions.BadRequestException)
        {
            // The refusal is the other test's subject; this one only cares about the row.
        }

        var still = await _ctx.Settlements.FirstOrDefaultAsync(x => x.Id == s.SurvivingDebtId);
        Assert.NotNull(still);
        Assert.Equal(15m, still!.Amount);
    }

    [Fact]
    public async Task A_recalculation_attempt_after_an_own_row_deletion_cannot_destroy_the_survivors_settlement()
    {
        // Same companion for the FIRST shape (the anonymised own row). Green from the moment the
        // original guard shipped — its value is as a revert pin: removing the guard destroys the
        // seeded settlement and this goes red on the missing row, not on an exception type.
        var s = SeedFullGraph();
        var payer = User.Create("payer", "payer@example.com", "hash");
        _ctx.Users.Add(payer);
        _ctx.SessionPlayers.Add(SessionPlayer.CreateForUser(s.Session.Id, payer.Id));
        var survivingDebt = Settlement.Create(s.Session.Id, payer.Id, s.Other.Id, 15m);
        _ctx.Settlements.Add(survivingDebt);
        var seeded = _ctx.Sessions.First(x => x.Id == s.Session.Id);
        seeded.Start();
        seeded.End();
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await DeleteAsync(s.Leaving.Id);

        var calc = new CalculateSettlementsCommandHandler(
            _ctx, new FakeCurrentUser(s.Other.Id), new SettlementCalculatorService());
        try
        {
            await calc.Handle(new CalculateSettlementsCommand(s.Session.Id), CancellationToken.None);
        }
        catch (Application.Common.Exceptions.BadRequestException)
        {
            // Swallowed on purpose — see the linked-guest companion.
        }

        var still = await _ctx.Settlements.FirstOrDefaultAsync(x => x.Id == survivingDebt.Id);
        Assert.NotNull(still);
        Assert.Equal(15m, still!.Amount);
    }

    [Fact]
    public async Task Deletion_stamps_the_account_deleted_marker_on_both_player_shapes()
    {
        // The unlinked guest row keeps GuestName, so the marker is the ONLY signal
        // CalculateSettlements has for that shape. It is stamped on the own-row shape too, so the
        // two cases stay symmetric and the guard reads one field instead of inferring shapes.
        var s = SeedFullGraph();

        await DeleteAsync(s.Leaving.Id);

        var ownRow = await _ctx.SessionPlayers.FirstAsync(sp => sp.Id == s.LeavingPlayerId);
        Assert.NotNull(ownRow.AccountDeletedAt);

        var guestRow = await _ctx.SessionPlayers.FirstAsync(sp => sp.GuestName == "Dan (guest)");
        Assert.NotNull(guestRow.AccountDeletedAt);

        // Players untouched by the deletion must NOT be stamped.
        var otherRow = await _ctx.SessionPlayers.FirstAsync(sp => sp.UserId == s.Other.Id);
        Assert.Null(otherRow.AccountDeletedAt);
    }

    [Fact]
    public async Task An_ordinary_unlinked_guest_does_not_trip_the_deleted_player_guard()
    {
        // The guard must not widen into refusing NORMAL guest sessions. A walk-in guest also has
        // no SettlementUserId; their sessions must keep recalculating, and their cash balance
        // must still be reported to the host.
        var host = User.Create("host", "host@example.com", "hash");
        _ctx.Users.Add(host);
        var session = Session.Create("Home game", host.Id);
        session.Start();
        session.End();
        _ctx.Sessions.Add(session);

        var spHost = SessionPlayer.CreateForUser(session.Id, host.Id);
        var spGuest = SessionPlayer.CreateForGuest(session.Id, "Walk-in Willie");
        _ctx.SessionPlayers.AddRange(spHost, spGuest);
        _ctx.BuyIns.Add(BuyIn.Create(session.Id, spGuest.Id, 50m));
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        var calc = new CalculateSettlementsCommandHandler(
            _ctx, new FakeCurrentUser(host.Id), new SettlementCalculatorService());

        var result = await calc.Handle(new CalculateSettlementsCommand(session.Id), CancellationToken.None);

        var guest = Assert.Single(result.GuestBalances);
        Assert.Equal(-50m, guest.NetBalance);
    }

    [Fact]
    public void Foreign_keys_to_User_match_the_acknowledged_inventory_with_delete_behaviors()
    {
        // THE REAL RATCHET — second correction. The first version of this test filtered on
        // Restrict/NoAction only, and the prose around it claimed "a migration adding a ninth
        // edge fails a test". That was FALSE for the most likely way a ninth edge gets added:
        // EF's CONVENTION for an optional reference FK (a nullable UserId + navigation with no
        // explicit OnDelete) is ClientSetNull, which relational providers emit as ON DELETE
        // NO ACTION — it blocks the delete of untracked dependents exactly like Restrict, and
        // an agent demonstrated account deletion re-breaking under a green ratchet that way.
        //
        // So: NO behavior filter. Every FK whose principal is User is pinned, WITH its delete
        // behavior. Any new edge — Restrict (blocks the delete), ClientSetNull/NoAction (blocks
        // it for untracked rows, i.e. always in DeleteAccountCommandHandler), Cascade (silently
        // deletes rows that may be other people's records), SetNull — forces a deliberate edit
        // here, which is the moment to ask "what must DeleteAccountCommandHandler do about
        // this?". A behavior CHANGE on an existing edge trips it too, which the old shape
        // could not see.
        var edges = _ctx.Model.GetEntityTypes()
            .SelectMany(e => e.GetForeignKeys())
            .Where(fk => fk.PrincipalEntityType.ClrType == typeof(User))
            .Select(fk => fk.DeclaringEntityType.ClrType.Name
                          + "." + string.Join("+", fk.Properties.Select(p => p.Name))
                          + ":" + fk.DeleteBehavior)
            .OrderBy(x => x, StringComparer.Ordinal)
            .ToArray();

        // Literal, not derived from the handler — a list computed from the code under test would
        // move with it. Every entry is cleared by the handler, blocked upstream, or handled by
        // the database (Cascade/SetNull), as noted.
        // Literal, not derived from the handler — a list computed from the code under test would
        // move with it. Restrict edges are each cleared by the handler or blocked upstream;
        // Cascade edges are handled by the database and are pinned so a NEW cascade (which would
        // silently delete rows on account deletion) is also a deliberate decision, not a default.
        string[] acknowledged =
        [
            "BuyIn.UserId:Restrict",                    // anonymised
            "CashOut.UserId:Restrict",                  // anonymised
            "CloudBackup.UserId:Cascade",
            "CreditBalance.UserId:Cascade",
            "CreditLedgerEntry.UserId:Cascade",
            "DeviceBinding.UserId:Cascade",
            "DeviceToken.UserId:Cascade",
            "Group.OwnerId:Restrict",                   // blocked upstream by the ownership precondition
            "GroupInvitation.InvitedByUserId:Restrict", // removed
            "GroupInvitation.InvitedUserId:Cascade",
            "GroupMember.UserId:Cascade",
            "Notification.UserId:Cascade",
            "RefreshToken.UserId:Cascade",
            "SessionPlayer.LinkedUserId:Restrict",      // unlinked + AccountDeletedAt stamped
            "SessionPlayer.UserId:Restrict",            // anonymised + AccountDeletedAt stamped
            "Settlement.PayerUserId:Restrict",          // removed
            "Settlement.ReceiverUserId:Restrict",       // removed
            "Subscription.UserId:Cascade",
            "UserAchievement.UserId:Cascade",
        ];

        Assert.Equal(acknowledged, edges);
    }

    [Fact]
    public async Task Owning_a_group_still_blocks_deletion_with_a_clear_message()
    {
        // The pre-existing guard must survive the fix: it is the one case where refusing is right,
        // because deleting an owner would orphan a group other people are still using.
        var owner = User.Create("owner", "owner@example.com", "hash");
        _ctx.Users.Add(owner);
        var group = Group.Create("Owned", null, owner.Id);
        _ctx.Groups.Add(group);
        _ctx.GroupMembers.Add(GroupMember.Create(group.Id, owner.Id, GroupRole.Owner));
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await Assert.ThrowsAsync<Application.Common.Exceptions.BadRequestException>(
            () => DeleteAsync(owner.Id));
    }
}
