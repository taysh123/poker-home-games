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
/// Danger Zone copy promises "permanently delete your account and all your data" — so a failing
/// delete is a compliance defect, not only a bug.
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
    private (User leaving, User other, Session session, Settlement settlement) SeedFullGraph()
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
        var settlement = Settlement.Create(session.Id, leaving.Id, other.Id, 40m);
        _ctx.Settlements.Add(settlement);

        // An invitation the leaving user SENT (InvitedByUserId is RESTRICT and required).
        var third = User.Create("third", "third@example.com", "hash");
        _ctx.Users.Add(third);
        _ctx.GroupInvitations.Add(GroupInvitation.Create(group.Id, leaving.Id, third.Id));

        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();
        return (leaving, other, session, settlement);
    }

    private async Task DeleteAsync(Guid userId)
    {
        var handler = new DeleteAccountCommandHandler(_ctx, new FakeCurrentUser(userId));
        await handler.Handle(new DeleteAccountCommand(), CancellationToken.None);
    }

    [Fact]
    public async Task Deletion_succeeds_for_a_user_with_the_full_production_FK_graph()
    {
        var (leaving, _, _, _) = SeedFullGraph();

        // The whole point: this must not throw. Before the fix it threw DbUpdateException on
        // SaveChanges (FK violation), surfacing to the live app as a generic 500 and
        // "Failed to delete account." for exactly the users engaged enough to have settlements.
        await DeleteAsync(leaving.Id);

        Assert.Null(await _ctx.Users.FirstOrDefaultAsync(u => u.Id == leaving.Id));
    }

    [Fact]
    public async Task Deletion_does_not_destroy_the_other_players_session_history()
    {
        var (leaving, other, session, _) = SeedFullGraph();

        await DeleteAsync(leaving.Id);

        // The group, the session and the remaining player's row belong to people who did NOT ask
        // to be forgotten. Erasing one account must not erase their books.
        Assert.NotNull(await _ctx.Sessions.FirstOrDefaultAsync(s => s.Id == session.Id));
        Assert.NotNull(await _ctx.Users.FirstOrDefaultAsync(u => u.Id == other.Id));
        Assert.True(await _ctx.SessionPlayers.AnyAsync(sp => sp.UserId == other.Id));
    }

    [Fact]
    public async Task Deletion_clears_every_restrict_reference_to_the_user()
    {
        var (leaving, _, _, _) = SeedFullGraph();

        await DeleteAsync(leaving.Id);

        // Each assertion is one RESTRICT FK from the model snapshot. If a future migration adds
        // another RESTRICT FK to Users and the handler is not updated, the FIRST test in this file
        // fails on the constraint — this one then localises which reference was missed.
        Assert.False(await _ctx.SessionPlayers.AnyAsync(sp => sp.UserId == leaving.Id));
        Assert.False(await _ctx.SessionPlayers.AnyAsync(sp => sp.LinkedUserId == leaving.Id));
        Assert.False(await _ctx.BuyIns.AnyAsync(b => b.UserId == leaving.Id));
        Assert.False(await _ctx.CashOuts.AnyAsync(c => c.UserId == leaving.Id));
        Assert.False(await _ctx.Settlements.AnyAsync(s => s.PayerUserId == leaving.Id || s.ReceiverUserId == leaving.Id));
        Assert.False(await _ctx.GroupInvitations.AnyAsync(i => i.InvitedByUserId == leaving.Id));
    }

    [Fact]
    public async Task The_anonymised_guest_row_survives_so_the_session_still_balances()
    {
        var (leaving, _, session, _) = SeedFullGraph();

        await DeleteAsync(leaving.Id);

        // A guest row linked to the leaving user represents a real person at a real table. Clearing
        // the LINK must not delete the player, or the session's participant list silently shrinks
        // and the other players' totals stop reconciling.
        var guest = await _ctx.SessionPlayers
            .FirstOrDefaultAsync(sp => sp.SessionId == session.Id && sp.GuestName == "Dan (guest)");
        Assert.NotNull(guest);
        Assert.Null(guest!.LinkedUserId);
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
