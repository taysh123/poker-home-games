using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Auth.Commands.DeleteAccount;
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
        // Groups.OwnerId is the sixth RESTRICT relationship. It is discharged by the ownership
        // precondition rather than cleared here; asserted so the test's name is honest.
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
    public void Restrict_foreign_keys_to_User_match_the_acknowledged_set()
    {
        // THE REAL RATCHET. An earlier version of this file claimed, twice, that "a future
        // migration adding a RESTRICT FK to Users fails this test". That was FALSE: the seeded
        // tests only violate a constraint on a row the seed happens to insert, so a RESTRICT edge
        // on a brand-new entity would sail through green. The claim was asserted in prose with no
        // mechanism behind it — the exact class this project has shipped six times.
        //
        // This assertion reads the EF MODEL, so it fails on the migration rather than on the seed.
        // Adding a RESTRICT/NoAction FK to Users now forces a deliberate edit here, which is the
        // moment to ask "does DeleteAccountCommandHandler need to clear this?".
        var restrictEdges = _ctx.Model.GetEntityTypes()
            .SelectMany(e => e.GetForeignKeys())
            .Where(fk => fk.PrincipalEntityType.ClrType == typeof(User)
                      && (fk.DeleteBehavior == DeleteBehavior.Restrict
                       || fk.DeleteBehavior == DeleteBehavior.NoAction))
            .Select(fk => fk.DeclaringEntityType.ClrType.Name
                          + "." + string.Join("+", fk.Properties.Select(p => p.Name)))
            .OrderBy(x => x, StringComparer.Ordinal)
            .ToArray();

        // Literal, not derived from the handler — a list computed from the code under test would
        // move with it. Every entry is either cleared by the handler or blocked upstream.
        string[] acknowledged =
        [
            "BuyIn.UserId",                    // anonymised
            "CashOut.UserId",                  // anonymised
            "Group.OwnerId",                   // blocked upstream by the ownership precondition
            "GroupInvitation.InvitedByUserId", // removed
            "SessionPlayer.LinkedUserId",      // unlinked
            "SessionPlayer.UserId",            // anonymised
            "Settlement.PayerUserId",          // removed
            "Settlement.ReceiverUserId",       // removed
        ];

        Assert.Equal(acknowledged, restrictEdges);
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
