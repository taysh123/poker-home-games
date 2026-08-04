using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Sessions.Commands.AddPlayer;
using PokerApp.Application.Features.Sessions.Commands.RemovePlayer;
using PokerApp.Application.Features.Users.Queries.SearchUsers;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Tests;

/// <summary>
/// The consent contract for putting a REGISTERED user into a session's financial ledger.
///
/// Before this slice, any authenticated user could create a standalone session, discover any
/// account through the unscoped user search, add them by id, record buy-ins against them, and
/// have CalculateSettlements persist a real debt naming them — with NO way for the target to
/// remove their own seat, and none at all once the session was Active (audit 2026-08-05, HIGH #1).
///
/// Three properties are pinned here. Self-removal is the load-bearing one: it is the recourse
/// for the residual case the group gate cannot cover — a group member adding another member to a
/// session they did not attend — so it must hold at EVERY session status.
///
/// SQLite (not the InMemory provider) for the same reason DeleteAccountFkIntegrityTests uses it:
/// these assertions are about real relational behaviour, and a guard that cannot fail is worse
/// than no guard because it reads as coverage.
/// </summary>
public sealed class AddPlayerConsentTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly AppDbContext _ctx;

    public AddPlayerConsentTests()
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
        public string? Email => "caller@example.com";
        public string? Username => "caller";
        public bool IsAuthenticated => true;
    }

    private User AddUser(string name)
    {
        var u = User.Create(name, $"{name}@example.com", "hash");
        _ctx.Users.Add(u);
        return u;
    }

    /// <summary>A group owned by <paramref name="ownerId"/> containing the given plain Members.</summary>
    private Group AddGroup(string name, Guid ownerId, params Guid[] memberIds)
    {
        var g = Group.Create(name, null, ownerId);
        _ctx.Groups.Add(g);
        _ctx.GroupMembers.Add(GroupMember.Create(g.Id, ownerId, GroupRole.Owner));
        foreach (var m in memberIds)
            _ctx.GroupMembers.Add(GroupMember.Create(g.Id, m, GroupRole.Member));
        return g;
    }

    private Task AddPlayerAsync(Guid callerId, AddPlayerCommand cmd) =>
        new AddPlayerCommandHandler(_ctx, new FakeCurrentUser(callerId)).Handle(cmd, CancellationToken.None);

    private Task RemovePlayerAsync(Guid callerId, Guid sessionId, Guid sessionPlayerId) =>
        new RemovePlayerCommandHandler(_ctx, new FakeCurrentUser(callerId))
            .Handle(new RemovePlayerCommand(sessionId, sessionPlayerId), CancellationToken.None);

    [Fact]
    public async Task A_user_who_shares_no_group_with_the_caller_cannot_be_added_by_id()
    {
        var host = AddUser("host");
        var stranger = AddUser("stranger");                        // no shared group — the target
        var session = Session.Create("Standalone night", host.Id); // GroupId null: the attack path
        _ctx.Sessions.Add(session);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        // NotFound, not Unauthorized: the handler already throws NotFound for a genuinely absent
        // user, so reusing it makes "does not exist" and "exists but is unreachable by you"
        // indistinguishable — the endpoint stops confirming that an arbitrary account exists.
        await Assert.ThrowsAsync<NotFoundException>(() =>
            AddPlayerAsync(host.Id, new AddPlayerCommand(session.Id, stranger.Id, null)));

        Assert.False(await _ctx.SessionPlayers.AnyAsync(sp => sp.UserId == stranger.Id));
    }

    [Fact]
    public async Task A_user_who_shares_a_group_with_the_caller_can_still_be_added_by_id()
    {
        var host = AddUser("host");
        var mate = AddUser("mate");
        AddGroup("Thursday", host.Id, mate.Id);
        var session = Session.Create("Standalone night", host.Id);
        _ctx.Sessions.Add(session);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await AddPlayerAsync(host.Id, new AddPlayerCommand(session.Id, mate.Id, null));

        Assert.True(await _ctx.SessionPlayers.AnyAsync(sp => sp.UserId == mate.Id));
    }

    [Fact]
    public async Task Adding_a_guest_by_name_is_unaffected_and_needs_no_group()
    {
        // The "they're sitting right here" fast path, and CLAUDE.md's minimal-taps invariant.
        // A guest has no account, so there is no victim and nothing to consent to.
        var host = AddUser("host");
        var session = Session.Create("Standalone night", host.Id);
        _ctx.Sessions.Add(session);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await AddPlayerAsync(host.Id, new AddPlayerCommand(session.Id, null, "Walk-in Willie"));

        Assert.True(await _ctx.SessionPlayers.AnyAsync(sp => sp.GuestName == "Walk-in Willie"));
    }

    [Fact]
    public async Task A_stranger_cannot_be_seated_via_a_linked_guest_seat()
    {
        // HIGH #1, the SIDE door. SettlementUserId is `LinkedUserId ?? UserId`, so a guest seat
        // carrying a LinkedUserId lands a REGISTERED account in the formal settlement ledger
        // exactly as a by-userId add would — buy-ins recorded against them, a real Settlement row
        // persisted naming them. And self-removal is keyed on `sp.UserId == callerId`, which is
        // NULL on a guest row, so the linked victim cannot even leave. The by-userId gate above
        // closed the front door; this path walked in the side one. Linking at add-time is now
        // refused outright — no client sends it (every addPlayer call site passes only userId or
        // guestName), so a consented linking flow, if ever built, is its own slice.
        var attacker = AddUser("attacker");
        var victim = AddUser("victim");                              // shares NO group with attacker
        var session = Session.Create("Standalone night", attacker.Id); // GroupId null: the attack path
        _ctx.Sessions.Add(session);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await Assert.ThrowsAsync<BadRequestException>(() =>
            AddPlayerAsync(attacker.Id, new AddPlayerCommand(session.Id, null, "V", victim.Id)));

        Assert.False(await _ctx.SessionPlayers.AnyAsync(sp => sp.LinkedUserId == victim.Id));
        Assert.False(await _ctx.SessionPlayers.AnyAsync(sp => sp.UserId == victim.Id));
    }

    [Fact]
    public async Task Linking_a_guest_is_not_an_account_existence_oracle()
    {
        // The by-userId gate made "absent" and "unreachable" indistinguishable so the endpoint
        // stops confirming whether an arbitrary account exists. The linked-guest path had its own
        // bare existence check — present id created a seat, absent id threw NotFound — which is the
        // same oracle by another door. Refusing the input BEFORE any lookup collapses both to one
        // response: same exception type, no seat, nothing observable about the id.
        var attacker = AddUser("attacker");
        var victim = AddUser("victim");
        var session = Session.Create("Standalone", attacker.Id);
        _ctx.Sessions.Add(session);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        var absent = await Assert.ThrowsAnyAsync<Exception>(() =>
            AddPlayerAsync(attacker.Id, new AddPlayerCommand(session.Id, null, "p1", Guid.NewGuid())));
        var present = await Assert.ThrowsAnyAsync<Exception>(() =>
            AddPlayerAsync(attacker.Id, new AddPlayerCommand(session.Id, null, "p2", victim.Id)));

        Assert.IsType<BadRequestException>(absent);
        Assert.IsType<BadRequestException>(present);        // SAME type as absent — existence not leaked
        Assert.False(await _ctx.SessionPlayers.AnyAsync()); // neither attempt created a seat
    }

    [Fact]
    public async Task A_user_can_always_remove_their_own_seat_even_mid_game_in_a_GROUP_session()
    {
        // THE LOAD-BEARING PROPERTY. Recourse for the residual case the group gate cannot cover.
        // Before this slice an Active session refused to remove a registered player at all, so a
        // victim was stuck in someone else's ledger until the host chose to end the game.
        var host = AddUser("host");
        var mate = AddUser("mate");
        var group = AddGroup("Thursday", host.Id, mate.Id);
        var session = Session.Create("Group night", host.Id, group.Id);
        session.Start();                                   // ACTIVE — the previously-blocked case
        _ctx.Sessions.Add(session);
        var seat = SessionPlayer.CreateForUser(session.Id, mate.Id);
        _ctx.SessionPlayers.Add(seat);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await RemovePlayerAsync(mate.Id, session.Id, seat.Id);   // the caller removes THEMSELVES

        Assert.Null(await _ctx.SessionPlayers.FirstOrDefaultAsync(sp => sp.Id == seat.Id));
    }

    [Fact]
    public async Task A_user_can_always_remove_their_own_seat_from_a_STANDALONE_session()
    {
        // The sharper half, and the one the first draft of this test missed: in a standalone
        // session `hasAccess` is `session.CreatorId == callerId`, so the victim — who is by
        // definition NOT the creator — is rejected by the ACCESS check before the status guard is
        // ever reached. Self-removal must therefore bypass access as well as status, or the
        // load-bearing property silently fails in exactly the place the attack lives (a
        // standalone session is what an attacker creates: no group needed).
        var host = AddUser("host");
        var mate = AddUser("mate");
        AddGroup("Thursday", host.Id, mate.Id);                    // shared group; session has none
        var session = Session.Create("Standalone night", host.Id); // GroupId null
        session.Start();
        _ctx.Sessions.Add(session);
        var seat = SessionPlayer.CreateForUser(session.Id, mate.Id);
        _ctx.SessionPlayers.Add(seat);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await RemovePlayerAsync(mate.Id, session.Id, seat.Id);

        Assert.Null(await _ctx.SessionPlayers.FirstOrDefaultAsync(sp => sp.Id == seat.Id));
    }

    [Fact]
    public async Task Removing_SOMEONE_ELSE_from_an_active_session_is_still_refused()
    {
        // The self-removal escape hatch must not widen into a general one: a host still cannot
        // pull another registered player out of a live game and rewrite the ledger under them.
        var host = AddUser("host");
        var mate = AddUser("mate");
        var group = AddGroup("Thursday", host.Id, mate.Id);
        var session = Session.Create("Group night", host.Id, group.Id);
        session.Start();
        _ctx.Sessions.Add(session);
        var seat = SessionPlayer.CreateForUser(session.Id, mate.Id);
        _ctx.SessionPlayers.Add(seat);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await Assert.ThrowsAsync<ConflictException>(() => RemovePlayerAsync(host.Id, session.Id, seat.Id));

        Assert.NotNull(await _ctx.SessionPlayers.FirstOrDefaultAsync(sp => sp.Id == seat.Id));
    }

    [Fact]
    public async Task A_stranger_still_cannot_remove_someone_elses_seat()
    {
        // The bypass is keyed on "this seat is MINE", not on "I asked nicely" — an unrelated
        // account must still be refused, or the recourse becomes a new attack.
        var host = AddUser("host");
        var mate = AddUser("mate");
        var stranger = AddUser("stranger");
        var group = AddGroup("Thursday", host.Id, mate.Id);
        var session = Session.Create("Group night", host.Id, group.Id);
        _ctx.Sessions.Add(session);
        var seat = SessionPlayer.CreateForUser(session.Id, mate.Id);
        _ctx.SessionPlayers.Add(seat);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            RemovePlayerAsync(stranger.Id, session.Id, seat.Id));

        Assert.NotNull(await _ctx.SessionPlayers.FirstOrDefaultAsync(sp => sp.Id == seat.Id));
    }

    [Fact]
    public async Task User_search_only_returns_people_who_share_a_group_with_the_caller()
    {
        // The DISCOVERY vector. Scoping the add while leaving search open would still let anyone
        // enumerate every username on the platform, and would still surface people the caller
        // cannot legitimately add — fixing one and leaving the other fixes nothing.
        var caller = AddUser("caller");
        var mate = AddUser("teammate");
        var stranger = AddUser("teamstranger");      // matches the same query substring
        AddGroup("Thursday", caller.Id, mate.Id);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        var results = await new SearchUsersQueryHandler(_ctx, new FakeCurrentUser(caller.Id))
            .Handle(new SearchUsersQuery("team"), CancellationToken.None);

        Assert.Contains(results, r => r.UserId == mate.Id);
        Assert.DoesNotContain(results, r => r.UserId == stranger.Id);
    }
}
