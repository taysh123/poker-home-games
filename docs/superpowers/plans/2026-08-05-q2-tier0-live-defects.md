# Q2 Tier 0 — Live-Defect Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the six audit HIGH findings that are live on a shipped App Store build and have no Q2 pillar to ride with.

**Architecture:** Six independent slices, one PR each, in the order below. T0.1 is the only multi-day task. Nothing here touches a Q2 pillar surface, so slices may be reordered if one blocks — except that T0.5's two halves (code fix + policy copy) ship together.

**Tech Stack:** .NET 8 / EF Core 8 / MediatR / FluentValidation / xUnit (backend); Expo + React Native + TypeScript / Jest (mobile).

## Global Constraints

- **Backend tests run in Docker, not natively.** Windows Smart App Control blocks freshly built unsigned DLLs on this machine (`FileLoadException … 0x800711C7`). Use: `docker exec pokerapp-dev dotnet test PokerApp.sln --nologo`. Start the container if absent: `docker run -d --name pokerapp-dev -v "C:\Dev\Projects\Personal\poker-app:/repo" -v pokerapp-nuget:/root/.nuget -w /repo mcr.microsoft.com/dotnet/sdk:8.0 sleep infinity`
- **Frontend tests run natively** from `apps/poker-mobile`: `npx jest`, `npx tsc --noEmit`.
- **Gates before every commit:** backend `0 Warning(s)` + all tests green; frontend `tsc` clean + `jest` green.
- **TDD is mandatory.** Write the test, watch it fail for the right reason, then implement.
- **Revert-test every fix** — reverting the production change must turn a test red. Record the observed red output in the PR body.
- **Pin literals, not symbols.**
- **Security-aware adversarial fleet at HIGH effort before every PR.** Verify raw per-agent output; never trust an "N/N returned" summary.
- **Mutating agents run in isolated git worktrees**, never the main checkout.
- **Workflow:** gates → commit → **push** → fleet → fix → PR → stop for owner merge.
- **Ship invariants:** nothing becomes purchasable; AI Coach makes zero API calls; premium stays honestly "coming soon"; guests keep the full free tier; honesty pins are extended or deliberately rewritten, never weakened; the store track is never blocked.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/PokerApp.Application/Features/Sessions/Commands/AddPlayer/AddPlayerCommandHandler.cs` | Gate add-by-`userId` on shared-group membership | T0.1 |
| `src/PokerApp.Application/Features/Users/Queries/SearchUsers/SearchUsersQueryHandler.cs` | Scope user discovery to shared groups | T0.1 |
| `src/PokerApp.Application/Features/Users/Queries/SearchUsers/SearchUsersQuery.cs` | (unchanged shape — handler gains a dependency) | T0.1 |
| `src/PokerApp.Application/Features/Sessions/Commands/RemovePlayer/RemovePlayerCommandHandler.cs` | Allow self-removal at any session status | T0.1 |
| `src/PokerApp.Tests/AddPlayerConsentTests.cs` | **New** — the whole T0.1 contract | T0.1 |
| `src/PokerApp.Domain/Entities/Session.cs` | Concurrency token | T0.2 |
| `src/PokerApp.Infrastructure/Persistence/Configurations/SessionConfiguration.cs` | Map the token | T0.2 |
| `src/PokerApp.Application/Features/Sessions/Commands/EndSession/EndSessionCommandHandler.cs` | Guard the achievement side effect | T0.3 |
| `apps/poker-mobile/package.json` + lockfile | axios ≥ 1.18.0 | T0.4 |
| `src/PokerApp.Domain/Entities/HandRecord.cs` | `AnonymizeCreator()` | T0.5 |
| `src/PokerApp.Application/Features/Auth/Commands/DeleteAccount/DeleteAccountCommandHandler.cs` | Scrub the creator GUID | T0.5 |
| `src/PokerApp.Application/Features/Sessions/Queries/GetSessionHandHistory/GetSessionHandHistoryQuery.cs` | Stop serving the GUID | T0.5 |
| `apps/poker-mobile/public/privacy.html` | Honest deletion scope | T0.5 |
| `apps/poker-mobile/src/utils/analytics.ts` | Non-retroactive opt-out | T0.6 |

---

## Task T0.1: AddPlayer consent, search scoping, and self-removal

**Audit:** HIGH #1. **Size:** 2 days. **Owner decision:** group-scope the add *and* the discovery query; self-removal always works; guests unchanged.

**Files:**
- Modify: `src/PokerApp.Application/Features/Sessions/Commands/AddPlayer/AddPlayerCommandHandler.cs:55-70` (the `else` branch)
- Modify: `src/PokerApp.Application/Features/Users/Queries/SearchUsers/SearchUsersQueryHandler.cs` (whole file)
- Modify: `src/PokerApp.Application/Features/Sessions/Commands/RemovePlayer/RemovePlayerCommandHandler.cs:35-38`
- Test: `src/PokerApp.Tests/AddPlayerConsentTests.cs` (new)

**Interfaces:**
- Consumes: `IApplicationDbContext`, `ICurrentUserService` (both already injected in AddPlayer/RemovePlayer; `SearchUsersQueryHandler` must **add** `ICurrentUserService`).
- Produces: no new public signatures. `SearchUsersQueryHandler`'s constructor gains a second parameter — DI is convention-scanned, so no registration edit is needed.

**Design notes (read before coding):**
- **"Shared group" is the rule for both session kinds.** A standalone session (`GroupId == null`) has no group to check, and that is exactly the attack path the audit demonstrated (create standalone → search any user → add them). So the gate is: *the target must share at least one group with the caller*, regardless of session kind. That is the same set `SearchUsers` will return, so a legitimate client can only ever offer reachable people.
- **Throw `NotFoundException`, not `Unauthorized`, for a non-shared-group target.** The handler already throws `NotFoundException(nameof(User), userId)` when the user doesn't exist; using the same exception for "exists but not reachable by you" makes the two cases indistinguishable to a caller, so the endpoint stops confirming whether an arbitrary account exists.
- **Self-removal deletes that player's money rows**, because `RemovePlayerCommandHandler` already deletes buy-ins/cash-outs for the removed seat (unified in PR #78). That is the correct, consistent behaviour: a person removing a seat they never consented to should not leave orphaned money. A legitimate player who self-removes mid-game can be re-added. Note this in the PR body so it is a recorded consequence, not a surprise.

- [ ] **Step 1: Create the test file with the shared-group gate tests (failing)**

Create `src/PokerApp.Tests/AddPlayerConsentTests.cs`:

```csharp
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
/// The consent contract for putting a REGISTERED user in a session's financial ledger.
///
/// Before this slice, any authenticated user could create a standalone session, discover any
/// account via the unscoped user search, add them by id, record buy-ins against them, and have
/// CalculateSettlements persist a real debt naming them — and the target had NO way to remove
/// their own seat (and none at all once the session was Active). Audit 2026-08-05, HIGH #1.
///
/// Three properties are pinned here, and self-removal is the load-bearing one: it is the
/// recourse for the residual case (a group member adding another member to a session they did
/// not attend), so it must hold at EVERY session status.
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

    public void Dispose() { _ctx.Dispose(); _conn.Dispose(); }

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

    /// <summary>A group containing exactly the given members, all as plain Members.</summary>
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

    [Fact]
    public async Task A_user_who_shares_no_group_with_the_caller_cannot_be_added_by_id()
    {
        var host = AddUser("host");
        var stranger = AddUser("stranger");           // no shared group — the attack target
        var session = Session.Create("Standalone night", host.Id);  // no GroupId
        _ctx.Sessions.Add(session);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        // NotFound, not Unauthorized: the endpoint must not confirm that an unreachable
        // account exists (it is indistinguishable from a genuinely absent user).
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
        // The "they're sitting right here" fast path. A guest has no account and no victim.
        var host = AddUser("host");
        var session = Session.Create("Standalone night", host.Id);
        _ctx.Sessions.Add(session);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await AddPlayerAsync(host.Id, new AddPlayerCommand(session.Id, null, "Walk-in Willie"));

        Assert.True(await _ctx.SessionPlayers.AnyAsync(sp => sp.GuestName == "Walk-in Willie"));
    }
}
```

- [ ] **Step 2: Run the tests and watch them fail for the right reason**

Run: `docker exec pokerapp-dev dotnet test PokerApp.sln --nologo --filter "FullyQualifiedName~AddPlayerConsentTests"`

Expected: `A_user_who_shares_no_group_with_the_caller_cannot_be_added_by_id` **FAILS** with `Assert.Throws() Failure: No exception was thrown` — the stranger is currently added successfully. The other two PASS (they pin behaviour that must not regress).

- [ ] **Step 3: Gate the add on shared-group membership**

In `AddPlayerCommandHandler.cs`, replace the `userExists` check inside the `else` branch (currently lines ~57-62):

```csharp
            var userId = request.UserId!.Value;

            // CONSENT GATE (audit 2026-08-05, HIGH #1). A registered user may only be put into a
            // session's financial ledger by someone they already share a group with — joining a
            // group is the consent gesture. Before this, any account could be added by id after
            // being found through the (then unscoped) user search, with no prior relationship and
            // no way for the target to remove their own seat.
            //
            // NotFoundException, not Unauthorized: the handler already throws NotFound for a
            // genuinely absent user, so reusing it makes "does not exist" and "exists but is not
            // reachable by you" indistinguishable — the endpoint stops confirming that an
            // arbitrary account exists. Guests (GuestName) are untouched: no account, no victim.
            var reachable = await context.GroupMembers
                .AnyAsync(mine => mine.UserId == callerId
                    && context.GroupMembers.Any(theirs =>
                        theirs.GroupId == mine.GroupId && theirs.UserId == userId),
                    cancellationToken);

            if (!reachable)
                throw new NotFoundException(nameof(User), userId);
```

Delete the now-redundant `userExists` lookup — `reachable` implies existence (a non-existent user has no group memberships).

- [ ] **Step 4: Run the tests and verify they pass**

Run: `docker exec pokerapp-dev dotnet test PokerApp.sln --nologo --filter "FullyQualifiedName~AddPlayerConsentTests"`
Expected: `Passed! - Failed: 0, Passed: 3`

- [ ] **Step 5: Add the self-removal tests (failing)**

Append to `AddPlayerConsentTests.cs`, inside the class:

```csharp
    private Task RemovePlayerAsync(Guid callerId, Guid sessionId, Guid sessionPlayerId) =>
        new RemovePlayerCommandHandler(_ctx, new FakeCurrentUser(callerId))
            .Handle(new RemovePlayerCommand(sessionId, sessionPlayerId), CancellationToken.None);

    [Fact]
    public async Task A_user_can_always_remove_their_own_seat_even_mid_game()
    {
        // THE LOAD-BEARING PROPERTY. This is the recourse for the residual case the group gate
        // does not cover — a group member adding another member to a session they did not
        // attend. It must hold at EVERY status; before this slice, an Active session refused to
        // remove a registered player at all, so a victim was stuck until the host ended the game.
        var host = AddUser("host");
        var mate = AddUser("mate");
        AddGroup("Thursday", host.Id, mate.Id);
        var session = Session.Create("Group night", host.Id);
        session.Start();                                  // ACTIVE — the previously-blocked case
        _ctx.Sessions.Add(session);
        var seat = SessionPlayer.CreateForUser(session.Id, mate.Id);
        _ctx.SessionPlayers.Add(seat);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await RemovePlayerAsync(mate.Id, session.Id, seat.Id);   // caller removes THEMSELVES

        Assert.Null(await _ctx.SessionPlayers.FirstOrDefaultAsync(sp => sp.Id == seat.Id));
    }

    [Fact]
    public async Task Removing_SOMEONE_ELSE_from_an_active_session_is_still_refused()
    {
        // The self-removal escape hatch must not become a general one: a host still cannot pull
        // another registered player out of a live game and rewrite the ledger under them.
        var host = AddUser("host");
        var mate = AddUser("mate");
        AddGroup("Thursday", host.Id, mate.Id);
        var session = Session.Create("Group night", host.Id);
        session.Start();
        _ctx.Sessions.Add(session);
        var seat = SessionPlayer.CreateForUser(session.Id, mate.Id);
        _ctx.SessionPlayers.Add(seat);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        await Assert.ThrowsAsync<ConflictException>(() => RemovePlayerAsync(host.Id, session.Id, seat.Id));

        Assert.NotNull(await _ctx.SessionPlayers.FirstOrDefaultAsync(sp => sp.Id == seat.Id));
    }
```

- [ ] **Step 6: Run and watch the self-removal test fail**

Run: `docker exec pokerapp-dev dotnet test PokerApp.sln --nologo --filter "FullyQualifiedName~AddPlayerConsentTests"`
Expected: `A_user_can_always_remove_their_own_seat_even_mid_game` **FAILS** with `ConflictException : Cannot remove a registered player from an active session.` The other new test passes already.

- [ ] **Step 7: Allow self-removal at any status**

In `RemovePlayerCommandHandler.cs`, replace the two guard clauses (currently lines 35-38):

```csharp
        // Self-removal is ALWAYS permitted, at any session status. It is the recourse that makes
        // the AddPlayer consent gate complete: a user who was seated without asking can always
        // leave, including mid-game (audit 2026-08-05, HIGH #1). Note this deletes that seat's
        // buy-ins/cash-outs, consistent with every other removal — leaving orphaned money behind
        // is the defect PR #78 fixed.
        var isSelfRemoval = sessionPlayer.UserId == callerId;

        if (!isSelfRemoval)
        {
            if (session.Status == SessionStatus.Active && !sessionPlayer.IsGuest)
                throw new ConflictException("Cannot remove a registered player from an active session.");
            if (session.Status != SessionStatus.Active && session.Status != SessionStatus.Draft)
                throw new ConflictException("Players can only be removed from Draft or Active sessions.");
        }
```

- [ ] **Step 8: Run and verify all five pass**

Run: `docker exec pokerapp-dev dotnet test PokerApp.sln --nologo --filter "FullyQualifiedName~AddPlayerConsentTests"`
Expected: `Passed! - Failed: 0, Passed: 5`

- [ ] **Step 9: Add the search-scoping test (failing)**

Append to the class:

```csharp
    [Fact]
    public async Task User_search_only_returns_people_who_share_a_group_with_the_caller()
    {
        // The DISCOVERY vector. Scoping the add without scoping search leaves the enumeration
        // hole open — an attacker could still harvest every username on the platform.
        var caller = AddUser("caller");
        var mate = AddUser("teammate");
        var stranger = AddUser("teamstranger");   // matches the same query substring
        AddGroup("Thursday", caller.Id, mate.Id);
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();

        var results = await new SearchUsersQueryHandler(_ctx, new FakeCurrentUser(caller.Id))
            .Handle(new SearchUsersQuery("team"), CancellationToken.None);

        Assert.Contains(results, r => r.UserId == mate.Id);
        Assert.DoesNotContain(results, r => r.UserId == stranger.Id);
    }
```

- [ ] **Step 10: Run and watch it fail to compile**

Run: `docker exec pokerapp-dev dotnet test PokerApp.sln --nologo --filter "FullyQualifiedName~AddPlayerConsentTests"`
Expected: **build error** `CS1729: 'SearchUsersQueryHandler' does not contain a constructor that takes 2 arguments`. This is the correct first failure.

- [ ] **Step 11: Scope the search query**

Replace the body of `SearchUsersQueryHandler.cs`:

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Users.Queries.SearchUsers;

public sealed class SearchUsersQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<SearchUsersQuery, List<UserSearchResultDto>>
{
    public async Task<List<UserSearchResultDto>> Handle(SearchUsersQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;
        var needle = request.Query.ToLower();

        // Scoped to people the caller already shares a group with (audit 2026-08-05, HIGH #1).
        // This is the discovery half of the AddPlayer consent fix: gating the add while leaving
        // search open would still let anyone enumerate every username on the platform, and would
        // still surface people the caller cannot legitimately add.
        return await context.Users
            .AsNoTracking()
            .Where(u => u.Username.ToLower().Contains(needle)
                && context.GroupMembers.Any(mine => mine.UserId == callerId
                    && context.GroupMembers.Any(theirs =>
                        theirs.GroupId == mine.GroupId && theirs.UserId == u.Id)))
            .OrderBy(u => u.Username)
            .Take(20)
            .Select(u => new UserSearchResultDto(u.Id, u.Username, u.AvatarEmoji, u.AvatarColor))
            .ToListAsync(cancellationToken);
    }
}
```

- [ ] **Step 12: Run the full backend suite**

Run: `docker exec pokerapp-dev dotnet test PokerApp.sln --nologo -v q`
Expected: `Passed! - Failed: 0` with the total up by 6.

Then verify zero warnings: `docker exec pokerapp-dev dotnet build PokerApp.sln --no-incremental --nologo -v q 2>&1 | grep -E 'Warning|error'`
Expected: `0 Warning(s)`

- [ ] **Step 13: Commit and push**

```bash
git checkout -b fix/addplayer-consent-idor
git add src/PokerApp.Application/Features/Sessions/Commands/AddPlayer/AddPlayerCommandHandler.cs \
        src/PokerApp.Application/Features/Users/Queries/SearchUsers/SearchUsersQueryHandler.cs \
        src/PokerApp.Application/Features/Sessions/Commands/RemovePlayer/RemovePlayerCommandHandler.cs \
        src/PokerApp.Tests/AddPlayerConsentTests.cs
git commit -m "fix(sessions): require a shared group to seat a registered player, and let anyone leave their own seat"
git push -u origin fix/addplayer-consent-idor
```

- [ ] **Step 14: Revert-test all three fixes in an isolated worktree**

```bash
git worktree add ../poker-app-mutants HEAD
docker run -d --name pokerapp-mutant -v "C:\Dev\Projects\Personal:/work" -v pokerapp-nuget:/root/.nuget -w /work/poker-app-mutants mcr.microsoft.com/dotnet/sdk:8.0 sleep infinity
```

Revert each of the three production changes **separately** in the worktree and record which test goes red:

| Mutant | Expected red test |
|---|---|
| Remove the `reachable` gate in AddPlayer | `A_user_who_shares_no_group_with_the_caller_cannot_be_added_by_id` |
| Remove the `isSelfRemoval` bypass | `A_user_can_always_remove_their_own_seat_even_mid_game` |
| Restore the unscoped `SearchUsers` `Where` | `User_search_only_returns_people_who_share_a_group_with_the_caller` |

Then clean up:
```bash
docker rm -f pokerapp-mutant
git worktree remove ../poker-app-mutants --force && git worktree prune
```

- [ ] **Step 15: Security-aware adversarial fleet at HIGH effort**

Dispatch a fleet against the branch specifically hunting: a remaining path to seat a non-shared-group user (other handlers, the invite-token flow, direct `SessionPlayer` creation); whether self-removal can be abused to corrupt a live ledger; whether the scoped search leaks membership by timing or by result-count; and whether guests regressed. **Read the raw per-agent output** — never trust the summary line.

- [ ] **Step 16: Open the PR and stop for owner merge**

PR body must state: the three pinned properties, the observed revert-test red output for each, and the recorded consequence that self-removal deletes that seat's money rows.

---

## Task T0.2: EndSession concurrency guard

**Audit:** HIGH #3. **Size:** 1 day.

**Files:**
- Modify: `src/PokerApp.Domain/Entities/Session.cs` (add `RowVersion`)
- Modify: `src/PokerApp.Infrastructure/Persistence/Configurations/SessionConfiguration.cs`
- Create: migration `SessionConcurrencyToken`
- Test: `src/PokerApp.Tests/EndSessionConcurrencyTests.cs`

**Interfaces:**
- Produces: `Session.RowVersion` (`uint`, EF concurrency token via `IsRowVersion()`/`xmin` mapping).

**Design note:** Postgres exposes the system column `xmin` as a natural rowversion; EF maps it with `.UseXminAsConcurrencyToken()` on Npgsql. SQLite (test provider) does not have `xmin`, so the *test* proves the handler's behaviour under a simulated concurrent commit rather than provider-level detection. Pin the handler contract, not the provider.

- [ ] **Step 1: Write the failing test**

Create `src/PokerApp.Tests/EndSessionConcurrencyTests.cs`:

```csharp
[Fact]
public async Task Ending_an_already_finished_session_does_not_add_a_second_set_of_cashouts()
{
    // Two "End Game & Settle" submits racing (two admins, or a client retry after a timeout).
    // Both read Status == Active and both insert a full FinalStacks set; the settlement math
    // sums every CashOut with no dedupe, so the loser DOUBLES a player's counted cash-out.
    var seeded = SeedActiveSessionWithOnePlayer();

    await EndAsync(seeded.HostId, seeded.SessionId, new[] { new FinalStackItem(seeded.SeatId, 100m) });
    await Assert.ThrowsAsync<ConflictException>(() =>
        EndAsync(seeded.HostId, seeded.SessionId, new[] { new FinalStackItem(seeded.SeatId, 100m) }));

    Assert.Equal(1, await _ctx.CashOuts.CountAsync(c => c.SessionPlayerId == seeded.SeatId));
}
```

- [ ] **Step 2: Run and confirm it fails**

Run: `docker exec pokerapp-dev dotnet test PokerApp.sln --nologo --filter "FullyQualifiedName~EndSessionConcurrencyTests"`
Expected: FAIL — either no exception, or `Assert.Equal() Failure: Expected 1, Actual 2`.

- [ ] **Step 3: Make the second end idempotent-or-refused**

In `EndSessionCommandHandler`, the existing `Status != Active` check already throws — confirm it runs *before* any `CashOut` insert, and add the concurrency token so two genuinely simultaneous transactions cannot both pass it:

```csharp
// Session.cs
public uint RowVersion { get; private set; }

// SessionConfiguration.cs
builder.Property(s => s.RowVersion).IsRowVersion();   // Npgsql: .UseXminAsConcurrencyToken()
```

- [ ] **Step 4: Generate the migration**

Run: `docker exec pokerapp-dev bash -c "export PATH=\$PATH:/root/.dotnet/tools && cd /repo/src/PokerApp.Infrastructure && dotnet ef migrations add SessionConcurrencyToken --startup-project ../PokerApp.API"`
Expected: `Done.` Verify the generated `Up()` is additive only.

- [ ] **Step 5: Run the full suite, then commit, push, fleet, PR**

Same gate/commit/push/fleet/PR cycle as T0.1.

---

## Task T0.3: EndSession achievement try/catch

**Audit:** HIGH #7. **Size:** 0.5 day.

**Files:**
- Modify: `src/PokerApp.Application/Features/Sessions/Commands/EndSession/EndSessionCommandHandler.cs:75`
- Test: `src/PokerApp.Tests/EndSessionAchievementFailureTests.cs`

- [ ] **Step 1: Write the failing test** — inject an `IAchievementEvaluator` stub that throws `DbUpdateException`; assert `Handle` completes and the session is Finished.

```csharp
[Fact]
public async Task A_failing_achievement_evaluation_does_not_fail_an_already_committed_session_end()
{
    var seeded = SeedActiveSessionWithOnePlayer();
    var handler = BuildHandler(evaluator: new ThrowingAchievementEvaluator());

    await handler.Handle(new EndSessionCommand(seeded.SessionId, Array.Empty<FinalStackItem>()), CancellationToken.None);

    var session = await _ctx.Sessions.FirstAsync(s => s.Id == seeded.SessionId);
    Assert.Equal(SessionStatus.Finished, session.Status);
}
```

- [ ] **Step 2: Run and confirm it fails** with the `DbUpdateException` propagating.

- [ ] **Step 3: Wrap the call** in the same pattern already used for notifications three lines below:

```csharp
        // Achievement unlock is a best-effort side effect of ending a session, not part of its
        // contract — and the session is ALREADY durably committed one line above. A unique-index
        // race on (UserId, AchievementKey) throws DbUpdateException, which the exception
        // middleware does not map, producing a bare 500 for a request that fully succeeded.
        // Same defect class as PR #74 and PR #78 (audit 2026-08-05, HIGH #7).
        try
        {
            await achievementEvaluator.EvaluateAsync(userId, request.SessionId, cancellationToken);
        }
        catch
        {
            // Non-critical: the session ended successfully regardless.
        }
```

- [ ] **Step 4: Run, gate, commit, push, fleet, PR.**

---

## Task T0.4: axios CVE bump

**Audit:** HIGH #8. **Size:** 0.5 day.

**Files:** `apps/poker-mobile/package.json`, `apps/poker-mobile/package-lock.json`

- [ ] **Step 1: Confirm the current advisory**

Run: `cd apps/poker-mobile && npm audit --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s).vulnerabilities.axios;console.log(a.severity, a.range, JSON.stringify(a.fixAvailable));})"`
Expected: `high >=1.0.0 <1.18.0 …`

- [ ] **Step 2: Bump within the existing range**

```bash
cd apps/poker-mobile && npm install axios@^1.18.0
```

- [ ] **Step 3: Verify the advisory clears**

Run: `npm audit --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s).vulnerabilities.axios ? 'STILL PRESENT' : 'CLEARED');})"`
Expected: `CLEARED`

- [ ] **Step 4: Gate the client**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc exit 0; all suites pass. **The 401-refresh interceptor is the highest-risk consumer** — confirm `apiClient` tests specifically pass.

- [ ] **Step 5: Commit, push, fleet, PR.**

---

## Task T0.5: HandRecord GUID scrub + privacy-policy rewrite

**Audit:** HIGH #4 + HIGH #5. **Size:** 1 day. **Both halves ship together.**

**Files:**
- Modify: `src/PokerApp.Domain/Entities/HandRecord.cs` (add `AnonymizeCreator()`)
- Modify: `src/PokerApp.Application/Features/Auth/Commands/DeleteAccount/DeleteAccountCommandHandler.cs`
- Modify: `src/PokerApp.Application/Features/Sessions/Queries/GetSessionHandHistory/GetSessionHandHistoryQuery.cs` (drop `CreatedByUserId` from the DTO)
- Modify: `src/PokerApp.Tests/DeleteAccountFkIntegrityTests.cs` (extend the ratchet)
- Modify: `apps/poker-mobile/public/privacy.html`

**Interfaces:**
- Produces: `HandRecord.AnonymizeCreator()` → sets `CreatedByUserId = Guid.Empty`.
- **Breaking:** `HandRecordDto` loses its `CreatedByUserId` member. Update `apps/poker-mobile/src/api/sessionsApi.ts`'s matching type in the same PR.

- [ ] **Step 1: Write both failing tests**

```csharp
[Fact]
public async Task Deleting_an_account_scrubs_the_creator_id_from_their_hand_records()
{
    var s = SeedFullGraph();
    var hand = HandRecord.Create(s.Session.Id, "Dan", 120m, null, s.Leaving.Id);
    _ctx.HandRecords.Add(hand);
    _ctx.SaveChanges();
    _ctx.ChangeTracker.Clear();

    await DeleteAsync(s.Leaving.Id);

    var after = await _ctx.HandRecords.FirstAsync(h => h.Id == hand.Id);
    Assert.NotEqual(s.Leaving.Id, after.CreatedByUserId);
}

[Fact]
public void The_hand_history_DTO_does_not_expose_a_creator_account_id()
{
    // The GUID was not merely sitting in a table — it was serialised to every session
    // participant, forever, with no product use (audit 2026-08-05, HIGH #4).
    Assert.DoesNotContain(
        typeof(HandRecordDto).GetProperties(),
        p => p.Name.Contains("CreatedBy", StringComparison.Ordinal));
}
```

- [ ] **Step 2: Run and confirm both fail.**

- [ ] **Step 3: Implement**

```csharp
// HandRecord.cs — the creator link has no product use once the account is gone.
public void AnonymizeCreator() => CreatedByUserId = Guid.Empty;
```

```csharp
// DeleteAccountCommandHandler.cs — alongside the BuyIn/CashOut anonymisation.
// HandRecord.CreatedByUserId is a bare Guid with NO modelled FK, so it is invisible to the
// FK-inventory ratchet and was never cleared — while GetSessionHandHistory served it verbatim.
var handRecords = await context.HandRecords
    .Where(h => h.CreatedByUserId == userId).ToListAsync(cancellationToken);
foreach (var h in handRecords) h.AnonymizeCreator();
```

Remove `CreatedByUserId` from `HandRecordDto` and its projection, and from the mobile `HandRecordDto` type.

- [ ] **Step 4: Extend the FK ratchet to catch the next one**

Add to `DeleteAccountFkIntegrityTests.cs` a test asserting that every `Guid`/`Guid?` property named `*UserId` on a mapped entity either has a modelled FK **or** appears in an acknowledged literal list — so `Session.CreatorId` and `ActivityLog.ActorUserId` (same shape, also unaddressed) cannot keep escaping review.

- [ ] **Step 5: Rewrite the policy — exact text for owner approval**

Replace the deletion paragraph in `apps/poker-mobile/public/privacy.html`:

```html
<p>Deleting your account permanently removes your profile, your login credentials, your
settlement records, your group memberships, your notifications and your device tokens.
Because T Poker records shared games, your display name may remain visible in other players'
history of games you played together — in their group activity feed and in hand records you
created. Those entries belong to their record of a shared game night.</p>
```

**Before this PR merges:** confirm consistency with the Apple and Google privacy declarations, and show the owner the final exact text. *Do not ship a legal-surface claim the owner has not seen in final form.*

- [ ] **Step 6: Record the name-retention decision in the audit doc**

Append to `docs/superpowers/specs/2026-08-03-pre-q2-audit.md` under the privacy finding, so nobody later "fixes" it by scrubbing names: *display names are retained deliberately — "Dan" in Dana's record of their game night is Dana's data, not Dan's; scrubbing it deletes Dana's memory of her own session. Owner decision 2026-08-05.*

- [ ] **Step 7: Gate both stacks, commit, push, fleet, PR.**

---

## Task T0.6: Analytics opt-out retroactivity

**Audit:** HIGH #6. **Size:** 0.5 day.

**Files:**
- Modify: `apps/poker-mobile/src/utils/analytics.ts`
- Test: `apps/poker-mobile/src/utils/__tests__/analyticsDispatch.test.ts`

- [ ] **Step 1: Write the failing test — the exact untested precondition**

```ts
it('never sends events buffered while opted out, even if the client starts later', async () => {
  // The existing opt-out test pre-creates the client via grantAnalyticsConsent(), which takes a
  // DIFFERENT, non-leaking path. This is the real-world case: the app OPENS already opted out
  // (persisted from a prior session), so no client exists, dispatch() returns early without
  // advancing `drained`, and opting back in drains everything buffered since launch.
  await initAnalyticsAlreadyOptedOut();
  track('study_spot_answered', { mode: 'spot', correct: true });   // during the opted-out window
  await setAnalyticsOptOut(false);                                  // client constructed HERE
  expect(capturedEvents).toHaveLength(0);
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `cd apps/poker-mobile && npx jest analyticsDispatch`
Expected: FAIL — `Expected length: 0, Received length: 1`.

- [ ] **Step 3: Make opt-out advance the drain cursor**

In `setAnalyticsOptOut`:

```ts
  if (next) {
    // Opting out forfeits everything buffered up to this moment. Without this, a client
    // constructed LATER (the app opened already opted out, so none existed) drains the whole
    // buffer on re-opt-in — including events generated while sharing was explicitly OFF.
    drained = buffer.length;
  }
```

- [ ] **Step 4: Run, gate (`npx tsc --noEmit && npx jest`), commit, push, fleet, PR.**

---

## Self-Review

**Spec coverage:** all six Tier 0 slices in §1 of the master plan have a task (T0.1–T0.6), each carrying its audit reference. The owner's three T0.1 requirements — scope the add, scope the discovery query, airtight self-removal — are Steps 3, 11 and 7 respectively, each with its own pinned test and revert-test row.

**Placeholders:** none. Every code step carries the actual code; every run step carries the exact command and expected output. The one deliberate deferral is T0.2's Postgres `xmin` mapping detail, which is stated as a provider note with the SQLite consequence spelled out rather than left as "handle the provider difference."

**Type consistency:** `AddPlayerCommand(sessionId, userId, guestName)` matches the shipped record. `SearchUsersQueryHandler`'s new second constructor parameter is reflected in both the test call site (Step 9) and the implementation (Step 11). `HandRecord.AnonymizeCreator()` is defined in T0.5 Step 3 and used in the same step. `FinalStackItem` and `EndSessionCommand` are used as they exist today.

**Known follow-on (not a gap):** removing `CreatedByUserId` from `HandRecordDto` is a breaking DTO change; the mobile type edit is called out inside T0.5 rather than split into its own task, since a reviewer could not sensibly approve one without the other.
