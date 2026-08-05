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

> **ADDENDUM (implementation, 2026-08-05 — the security fleet on the built branch): T0.1 grew a fourth part.** The three parts above closed the by-`userId` door but not the `GuestName` + `LinkedUserId` door. Because `SessionPlayer.SettlementUserId` is `LinkedUserId ?? UserId`, a guest seat carrying a `LinkedUserId` lands a registered account in the *formal* settlement ledger exactly as a by-`userId` add would — and the guest branch ran only a bare existence check, so any stranger could be seated (and, since self-removal keys on `UserId`, which is null on a guest row, **could not even leave**). It was also the same account-existence oracle the by-`userId` gate removed. A fleet probe proved the full chain end-to-end. **Fix (shipped in this slice): reject `LinkedUserId` at add-time (`BadRequestException` → 400), before any lookup, so absent and present ids are indistinguishable.** No client sends it (every `addPlayer` call site passes only `userId` or `guestName`), so it is a hard rejection, not a gated path — the dead client param was removed too. Pins: `A_stranger_cannot_be_seated_via_a_linked_guest_seat`, `Linking_a_guest_is_not_an_account_existence_oracle` (both revert-tested). The same review surfaced a self-removal ledger-integrity hole that is **not** shipped here — see **T0.7**.

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

> **ADDENDUM (implementation, 2026-08-05): the design note above was NOT followed, deliberately.** The two sketched options were rejected for **different** reasons — both established by execution in the review fleet, not by reasoning:
> - `IsRowVersion()` marks the property store-generated, and *nothing generates it* on PostgreSQL or SQLite (only SQL Server does). On **PostgreSQL it is genuinely inert**: with the shipped `DEFAULT 0` column the token stays `0`, every check compares `0` to `0`, and both racers commit — coverage-shaped protection that protects nothing, the exact anti-pattern `AddPlayerConsentTests` was written to avoid. On **SQLite it fails loudly instead** (EF omits a store-generated property from the INSERT, so every seed hits `NOT NULL constraint failed: Sessions.Version`).
> - `.UseXminAsConcurrencyToken()` **would actually work in production** — `xmin` is a real PostgreSQL rowversion, and the fleet ran the race against it successfully. It is disqualified for different reasons: `xmin` is a PostgreSQL system column SQLite does not have, so the suite could never exercise the guard at all, and the API is `[Obsolete]` in Npgsql 8.
>
> *(An earlier version of this addendum claimed both options "would have shipped a guard that CANNOT FAIL". That was false for `xmin` and is corrected here — an overreaching justification is exactly the kind of claim a later reader acts on.)*
>
> **Shipped instead: an application-managed token** — `Session.Version` (`int`), bumped in the domain by `Start()`/`End()` and configured with `.IsConcurrencyToken()`. It behaves identically on both providers, so the race is *proven* rather than simulated, and the plan's "pin the contract, not the provider" hedge became unnecessary. `int`, not `uint`, because the token is no longer `xmin`-shaped and `int` maps cleanly with no unsigned ambiguity (migration emits `integer NOT NULL DEFAULT 0`).
>
> **Scope grew by one row, on the owner's instruction** ("one mechanism covering both is better than two guards"): the same token now guards `SessionInviteToken` (`Use()`/`Revoke()`), closing the audit MEDIUM *"invite-token redemption is not atomic"* — which the audit itself calls "the same TOCTOU class as EndSession". It could not be the *same row*: EndSession mutates `Session`, but JoinSessionByToken only **reads** it and mutates the token, so a `Session` token would never have appeared in that handler's `UPDATE`. One mechanism, applied per aggregate root. The audit's alternative for it (`UPDATE ... WHERE UsedAt IS NULL`, checking rows-affected) is what EF's concurrency token does generically.
>
> Also shipped: `ExceptionHandlingMiddleware` maps `DbUpdateConcurrencyException` → **409**, because a token on `Session` means other session writers (rename, notes) can now lose a race, and unmapped that surfaces as a bare 500. Handled 4xx also stopped logging at `Error` as "Unhandled exception" — this slice makes a lost race *routine*, and burying it among genuine faults would defeat the point of turning it into a 409.
>
> **ONLY `End()` advances the token** — a correction forced by the review fleet, which caught a regression the first implementation introduced. Bumping in `Start()` made `AddBuyIn`'s Draft auto-start a token writer, so two concurrent **first buy-ins** raced and the loser's **buy-in row rolled back with the rejected UPDATE** — real money silently dropped on the live-session critical path (proven against PostgreSQL; a control on an already-Active session isolated the bump as the cause). Nothing about *starting* a session needs serialising: both racers want the same end state and neither decision depends on winning. Ending does. Pinned by `Two_concurrent_first_buyins_on_a_draft_session_both_record`.

---

## Review-spawned follow-ups from the T0.2 fleet (recorded 2026-08-05, none shipped in T0.2)

Each was found by execution against **real PostgreSQL**, which the SQLite suite structurally cannot reach. All three are pre-existing on `main` — T0.2 neither introduced nor fixed them.

- **T0.8 — Concurrent same-user invite redemption returns 500 on PostgreSQL.** One user redeeming their own link twice (double tap, or a retry after timeout) has both requests pass `alreadyInSession == false`; on Npgsql the `SessionPlayers` INSERT batches first and raises `23505` on `IX_SessionPlayers_SessionId_UserId` as a **`DbUpdateException`**, which nothing maps → 500. The identical scenario on SQLite orders differently and returns a clean 409, so *the T0.2 suite is structurally incapable of catching this class*. Right fix is the **idempotent** path the handler already implements for the non-racing case: on a unique violation, re-read the caller's existing seat and return it — a user who joined twice did join. **Needs a PostgreSQL-backed test fixture (Testcontainers) to pin**, which is why it is its own slice rather than an untested patch bolted onto T0.2.
- **T0.9 — A failed or slow migration silently 500s the whole Sessions surface.** `Program.cs` runs `Database.Migrate()` fire-and-forget after `ApplicationStarted` and only *logs* on failure, while `/health` returns `Healthy` unconditionally — so traffic is served against a schema the code cannot read, permanently if the migration failed. Pre-existing pattern, but T0.2 is the first migration to put a mapped scalar on the hottest money-path table: `Version` lands in the **SELECT list of every `Session` materialisation**, so a missing column breaks session detail/start/end/buy-in/rename/join, not just the guard. Fix: gate readiness on migrations having applied (`/health` → 503 until then) so a failed migration fails the deploy instead of quietly serving 500s.
- **Remaining money hole (same class as HIGH #3, NOT closed by T0.2):** `AddCashOut` racing `EndSession` still double-counts a seat, because `AddCashOut` never touches the `Session` row and so never carries the token. Fold into whichever slice takes cash-out authorisation.
- **⚠ OWNER ACTION — GATES THE 1.2.0 SUBMISSION: verify the filed store privacy forms against the rewritten policy.** T0.5 changed the account-deletion wording on a live legal surface. The new text contradicts **neither** store declaration (Google's Data Safety form only asks *whether* a deletion path exists — Yes, in-app + the `privacy.html#delete` URL, both still true; Apple's App Privacy declares what is *collected*, not deletion scope). **But our two internal records of what was filed disagree with each other in four specific ways**, and only App Store Connect / Play Console can settle which is right. Owner will check the live forms before 1.2.0 ships; agents must **not** edit the store forms or these docs. The four discrepancies:
  1. **Apple → Contact Info → Name.** `docs/release/store-data-safety.md` declares "Email Address; **Name (username)**"; `docs/ios-release-readiness.md`'s table has **no Name row** at all. The app does collect a username, and Google's form declares Name — so the iOS table looks incomplete.
  2. **Apple → analytics rows missing entirely.** `ios-release-readiness.md` lists no `Usage Data → Product Interaction` and no "Data Not Linked to You" section, even though its own prose two lines earlier says consent-gated PostHog analytics ships. `store-data-safety.md` declares both.
  3. **Apple → `Identifiers → Device ID` means different things in the two docs.** `ios-release-readiness.md` maps it to the **Expo push token**; `store-data-safety.md` maps it to **PostHog's random app-scoped id**. These are different identifiers with different purposes (App Functionality vs Analytics) and arguably need two separate entries.
  4. **Google → `App activity → Other user-generated content`.** Declared in `docs/data-safety.md`'s questionnaire answers, but absent from `store-data-safety.md`'s Google table.
- **⏳ REMOVE THE TRANSITIONAL `HandRecordDto.CreatedByUserId` once the pre-`IsMine` install base has turned over (owner-approved 2026-08-05).** T0.5 replaced the raw creator GUID with `IsMine`, which silently removed the delete-hand button on already-shipped builds (they drew it from `createdByUserId === user.userId`, permanently false once the field vanished — a *missing* button, not a dead one, self-healing on update, but with no explanation to the user). Owner chose full-polish over purity, so the field is back for one release, populated **only with the caller's own id** (`Guid.Empty` for anyone else's hand) — which discloses nothing, since the caller already has their own id. **This is scheduled cruft, not a permanent shape:** delete the field from `HandRecordDto` and its projection once App Store / Play adoption of the `IsMine` build makes the old path irrelevant. The privacy property is pinned behaviourally by `HandHistoryPrivacyTests.The_transitional_creator_id_is_only_ever_the_callers_own` — that pin must survive the removal in spirit (no account identifier on the wire), even though the field it asserts on will be gone.
- **SessionDetailDto.CreatorId ships the same raw-GUID-on-the-wire defect T0.5 just fixed, one endpoint over.** `Session.CreatorId` is served to every session participant and, unlike the hand-record id, is *not* scrubbed on deletion. Same class, same fix shape (the client uses it only to decide creator-only affordances, so a server-computed boolean replaces it). The T0.5 ratchet annotation was corrected to record that it **is** scrubbable — the earlier "load-bearing, would break access control" note was wrong, since the creator's account is gone either way and no live caller can match it. Fold into T0.10 or its own small slice.
- **T0.10 — Finish de-silencing the best-effort catches (owner-agreed 2026-08-05, from the T0.3 fleet).** Three bare `catch { /* notifications are non-critical */ }` sites remain: `InviteUserToGroupCommandHandler`, `MarkSettlementPaidCommandHandler`, `MarkAllMySettlementsPaidCommandHandler`. None is a correctness defect — all are already guarded, so no 500 escapes — but T0.3's own rationale ("an unrecorded failure is a notification nobody knows was never sent") applies identically to a settlement-paid notification. Each needs an `ILogger` on its handler, the same one-parameter change T0.3 made. Same class, so **one PR covers all three**. Fold in the related nit while there: `PokerApp.Application` uses `ILogger` but declares no logging package reference — it resolves transitively via EF Core/MediatR today (fragility, not breakage), so add an explicit `Microsoft.Extensions.Logging.Abstractions` reference where the code actually uses it.

**Honest limit to state at release:** optimistic concurrency only binds writers that carry the token, so during a **rolling deploy** an old-build writer racing a new-build writer still reproduces the doubled cash-out (demonstrated). The guard becomes fully effective once a single build is serving.

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

> **ADDENDUM (implementation, 2026-08-05) — what shipped, and a correction to the record.**
>
> **Shipped `^1.19.0`, not the plan's `^1.18.0`, and that mattered.** Both clear the axios advisory, but only 1.19.0 raises the `form-data` floor to `^4.0.6` (`axios@1.18.0` and `1.18.1` both still require `^4.0.5`). `form-data` 4.0.0–4.0.5 carries its own **High** — GHSA-hmw2-7cc7-3qxx, CRLF injection, CVSS 7.5 — so `^1.18.0` would have left it in place and the audit total at 27. The bump cleared **two** packages, not one: totals 28 → 26, high 9 → 7.
>
> **CORRECTION — the commit message for `d9c66ac` overstated the severity, in the wrong direction.** It said "TEN high-severity advisories". `npm audit` reports **one** High (GHSA-gcfj-64vw-6mp9, Node-HTTP-adapter proxy inheritance) and **nine** moderate; the package-level `"severity": "high"` npm prints is the MAX over `via`, not a count, and that is what was misread. Worse, the five advisories the message named as examples are all *moderate*, while the single High was the one it omitted. The pre-Q2 audit had this **right** ("most moderate, one High: GHSA-gcfj-64vw-6mp9") — the commit degraded an accurate finding into an inflated one. Honest exploitability note: that single High is Node-HTTP-adapter/proxy scoped, and the app ships the browser/react-native axios build (`package.json` `exports` maps the `react-native` condition to `dist/browser/axios.cjs`), so on-device exposure to it was **nil**. The bump is still correct — it is a supply-chain hygiene fix, not an incident response.
>
> **CORRECTION — "the remaining 26 are all transitive (`isDirect: false`)" is false.** Seven surface as **direct** packages: `expo`, `expo-auth-session`, `expo-constants`, `expo-notifications`, `expo-splash-screen`, `react-native-markdown-display` (dependencies) and `jest-expo` (devDependency). The vulnerable *code* is transitive in each case, but the sentence asserted a property of `npm audit` output that the output contradicts — and that output is exactly what a future reader re-runs to check it. Six of the seven need an Expo 54 → 57 major.
>
> **CORRECTION — calling the remainder "build/tooling" is wrong for two of them.** `react-native-markdown-display` → `markdown-it` → `linkify-it` is **runtime UI in the shipped bundle**: `src/components/Markdown.tsx` imports it and `LessonReaderScreen` renders `<Markdown>{s.body}</Markdown>`. Both leaves carry High advisories with **`fixAvailable: false`** — see the follow-up below.
>
> **Verified clean (fleet, by execution):** the lockfile diff touches only the axios range, `node_modules/axios` and `node_modules/form-data`; all 1405 entries resolve to `registry.npmjs.org`; `integrity` hashes independently recomputed from freshly packed tarballs **match**; `npm audit signatures` verified 1364/1364 signatures and 129 attestations, with an SLSA-v1 provenance attestation on axios 1.19.0. No other axios pin exists in the repo and all CI jobs use `npm ci`, so the lockfile governs CI, Vercel and EAS.

**Review-spawned follow-ups (recorded 2026-08-05, none shipped in T0.4):**
- **`markdown-it` / `linkify-it` High advisories are reachable at RUNTIME with no upstream fix.** They ship inside the lesson reader, and `fixAvailable: false` means no version bump resolves them — this needs a *decision* (replace the markdown renderer, pre-render lesson bodies, or accept and document), which is why it is not a bump. The exposure is bounded: lesson bodies are **bundled content we author**, not user input, so there is no untrusted-input path today; the risk arrives the moment any user-supplied or remote markdown is rendered.
- **Nothing in CI stops a dependency regressing into a vulnerable range** — no `npm audit` gate runs, so this whole class is caught only when someone looks. A `--audit-level=high` check (with a documented allow-list for the unfixable Expo leaves) would make it standing.
- **`apiClient` writes `Authorization` by raw index assignment onto an `AxiosHeaders` instance.** Inert today (every one of the 16 call sites uses capital `Authorization`), and NOT introduced by this bump, but a lowercase caller would produce two Authorization keys on one headers object, with the right value winning only by insertion order. `config.headers.set('Authorization', …)` is case-normalising and removes the accident.
- **A rejected *refreshed* token does not log the user out.** `return apiClient(config)` is not awaited, so the retry's rejection never reaches the `catch` that calls `onUnauthenticated` — the user keeps a dead access token and sees a raw 401. Current behaviour is now pinned in both directions; whether it is *correct* is an open auth question, deliberately not changed inside a dependency slice.

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

## Task T0.7: Self-removal ledger integrity (recourse vs. debt-escape)

**Audit:** T0.1 security fleet, 2026-08-05 (review-spawned; not in the original §1 block). **Size:** design first, then ~1–2 days. **Owner decision (2026-08-05):** do NOT bundle a guard into T0.1 — ship the live HIGH #1 fix, give this its own slice, because it is a genuine design problem and a rushed guard risks reopening the consent hole T0.1 just closed. **Status: DESIGN — no implementation pre-committed. Start with `superpowers:brainstorming`.**

**The defect (confirmed by code reading; execution-confirmed by the T0.1 fleet re-run).** T0.1 made self-removal bypass both the access check and the status guard, keyed on `sessionPlayer.UserId == callerId`. That was necessary — it is the recourse that completes the consent gate. But `RemovePlayerCommandHandler` deletes the seat's buy-ins/cash-outs **unconditionally, at any status**, so:

1. **Debt-escape.** A player who legitimately joined, bought in, and lost can self-remove *before settlement* to delete their own recorded loss. Poker money is conserved — a loser's buy-in funds the winners' cash-outs — so deleting the loser's buy-in leaves the winners' cash-outs unfunded and the settlement no longer reconciles. **The winners are silently shorted.** This disturbs the *other* players' totals, which is the sharp harm (a debtor "leaving the table" alone would be tolerable; corrupting everyone else's numbers is not). *Fleet-executed (2026-08-05): a 3-player ACTIVE session, each buys in 300, loser busts, host cashes 500 / winnerB cashes 400 (conserved 900/900); after the loser self-removes, the pool is 600 in / 900 out (imbalance 300), and `CalculateSettlements` produces **0** settlements — host's +200 and winnerB's +100 are funded by nobody. `SettlementCalculatorService`'s `while (d < debtors.Count)` loop never runs with zero debtors, so every creditor yields no instruction.*
2. **Post-settlement corruption.** Self-removal is allowed on a **Finished** session too (the status guard is only on the non-self branch). If settlements were already calculated, the seat vanishes — not anonymized — so `CalculateSettlements`' deleted-player guard (which keys on `AccountDeletedAt` or the all-null shape) does **not** catch it, and any recalculation destroys the correct recorded set. *Fleet-executed PROBE7: before = one row "loser pays host 500"; after self-removal + recalc = 0 rows, loser owes 0, host receivable 0.* `Settlement` rows store raw `PayerUserId`/`ReceiverUserId` (FK to `User`, not to `SessionPlayer`), so stale rows naming the departed player survive the removal itself — and because the recalc `RemoveRange` is filtered to `Status == Pending` (`CalculateSettlementsCommandHandler.cs:152-155`), a **Paid** settlement row naming a now-seatless player survives even a recalculation, sitting alongside the rewritten Pending set. A real fix must reconcile or anonymize surviving `Settlement` rows *including Paid ones*, consistent with account-deletion handling.
3. **New capability, not pre-existing.** Before T0.1 a registered player could not be removed from an Active session at all, and nobody could be removed from a Finished one. T0.1's bypass is what introduces both windows.

**Why it can't be auto-fixed cheaply.** The legitimate consent recourse (a victim seated without asking, with a *fabricated* buy-in recorded against them, deleting it to escape) and the debt-escape (a real debtor deleting a *real* buy-in) are **the same operation on the same row shape**. The only difference is consent, which the schema does not record. So "refuse self-removal once the seat has money" would block the debt-escape *and* the recourse — reopening HIGH #1 for any victim the attacker was quick enough to record a buy-in against. Any real fix must add or infer a consent/authenticity signal, not just gate on "has money."

**Blast-radius mitigant (why this is major, not a blocker).** Settlements are **advisory** — cash is settled offline (CLAUDE.md "Out of Scope: payment integration — cash settled offline; debt system — removed"). No in-app money moves, so this corrupts *computed* numbers, not funds. Everyone at the physical table still knows who owes what. The acute harm T0.1 fixes (a stranger *named* in your ledger) is the one that shipped; this is the integrity of the computed set.

**Preserved artifact.** The debt-escape probe (`ZZProbeSelfRemovalAbuseTests.cs` — PROBE7, the Finished/settled case) is preserved verbatim at `docs/superpowers/specs/2026-08-05-t07-debtescape-probe.cs.txt`. It was written by the first (quota-killed) fleet and **executed and confirmed** by the T0.1 refix fleet against HEAD `a55b7c6` in a Linux container using the real handlers. Fold it into this slice as the failing test that drives the fix (it must go from passing-exploit to failing-blocked, revert-tested), and add the Active pre-settlement case (numbers above) as a second pin.

**Candidate directions (to weigh in brainstorming — none chosen):**
- **Soft-remove / tombstone the seat** instead of deleting money: exclude it from the *participant view* but keep its buy-ins/cash-outs in the pot so the ledger still balances — then decide separately how a victim's fabricated money is neutralized (this is the crux; a victim needs their money *gone*, a debtor must not).
- **Status-scope the recourse:** raw self-removal only in Draft/Active-pre-settlement; on a Finished/settled session, self-removal becomes a *dispute/flag* to the creator rather than a silent delete — protects the recorded set, but must still give the victim real relief.
- **Record consent at add-time:** e.g. a pending/accepted state on `SessionPlayer` so "seated but unconfirmed" is distinguishable from "played" — then self-removal of an *unconfirmed* seat deletes freely, while a *confirmed* seat's exit is ledger-preserving. Richer; needs a migration and a client change.
- **Refuse-and-reconcile:** allow the exit but, when it would unbalance a session with recorded money, require the actor to acknowledge the resulting cash-balance carve-out (like the walk-in-guest projection) rather than silently dropping it.

**Gate/commit/push/fleet/PR cycle as T0.1, once a direction is chosen.**

---

## Self-Review

**Spec coverage:** all six Tier 0 slices in §1 of the master plan have a task (T0.1–T0.6), each carrying its audit reference. The owner's three T0.1 requirements — scope the add, scope the discovery query, airtight self-removal — are Steps 3, 11 and 7 respectively, each with its own pinned test and revert-test row. **Two review-spawned additions (2026-08-05):** T0.1 gained a fourth part in implementation (reject `LinkedUserId` at add-time — the linked-guest side-door that reopened HIGH #1; see the T0.1 addendum), and **T0.7** was added for the self-removal ledger-integrity hole the same fleet surfaced — a design slice deliberately kept out of T0.1 by owner decision.

**Placeholders:** none. Every code step carries the actual code; every run step carries the exact command and expected output. The one deliberate deferral is T0.2's Postgres `xmin` mapping detail, which is stated as a provider note with the SQLite consequence spelled out rather than left as "handle the provider difference."

**Type consistency:** `AddPlayerCommand(sessionId, userId, guestName)` matches the shipped record. `SearchUsersQueryHandler`'s new second constructor parameter is reflected in both the test call site (Step 9) and the implementation (Step 11). `HandRecord.AnonymizeCreator()` is defined in T0.5 Step 3 and used in the same step. `FinalStackItem` and `EndSessionCommand` are used as they exist today.

**Known follow-on (not a gap):** removing `CreatedByUserId` from `HandRecordDto` is a breaking DTO change; the mobile type edit is called out inside T0.5 rather than split into its own task, since a reviewer could not sensibly approve one without the other.
