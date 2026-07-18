# Backlog tickets — deferred during the launch buildout

Captured intentionally so they aren't forgotten. None of these are built in the launch buildout; each
needs its own dedicated work + tests.

---

## 1. Cloud Sync — `xmin` EF concurrency-token hardening
**Priority:** low (self-healing today) · **Area:** backend (`src/`)

Cloud Sync (S7a) uses an **app-level** optimistic concurrency check: `PutSyncBlobCommandHandler` compares
the client's `BaseVersion` to the stored `CloudBackup.Version` and throws `ConflictException` (409) on a
mismatch. Two *simultaneous* PUTs by the same user (two devices, same instant) can both read the same
version, both pass the check, and one update is lost.

**Why it's only low priority:** it self-heals. The client always GET→merge→PUT, and each backup saves the
merged file locally *before* the PUT, so the loser's data is never lost on-device — it re-GETs, re-merges,
and re-PUTs on the next sync, and the cloud converges. No permanent data loss.

**The hardening:** make `CloudBackup.Version` (or a shadow `xmin`) a real EF/Npgsql concurrency token —
`builder.UseXminAsConcurrencyToken()` (uses Postgres's system `xmin`, **no schema column added**). Then the
losing `SaveChanges` throws `DbUpdateConcurrencyException` → map to `ConflictException` (409) for immediate
conflict detection.
- Files: `Infrastructure/Persistence/Configurations/CloudBackupConfiguration.cs`,
  `Application/Features/Sync/Commands/PutSyncBlobCommand.cs` (add the catch).
- Note: EF-InMemory can't exercise xmin — needs a real-Postgres integration test to cover it.

---

## 2. Cloud Sync — tombstone compaction
**Priority:** low (only matters at scale) · **Area:** client (`apps/poker-mobile/src/local/`)

Deleted local games become **tombstones** (`deletedAt` set, record kept) so deletions propagate across
devices on merge. Tombstones persist forever, so a heavy user's synced payload grows unbounded.

**The fix:** compact tombstones that are old AND confirmed-synced — e.g. drop tombstones with
`deletedAt` older than 30 days once they're present in the last successfully-PUT cloud version, so the
payload stays small. Be careful not to compact a tombstone a never-synced device still needs.
- Files: `local/localGamesStore.ts` (or `local/cloudSyncService.ts`); add merge/compaction tests.

---

## 3. Single active session / device-login management
**Priority:** post-launch (dedicated feature) · **Area:** backend auth + client · **NOT part of Cloud Sync**

A NEW auth feature, deliberately deferred to **post-launch** so it gets proper design, build, and testing.

**Goal:** when a user signs in on a new device, either (a) invalidate the previous device's session
(force-logout elsewhere), or (b) warn "you're already signed in on another device." Product decision needed
on warn-vs-invalidate (and whether it's user-configurable).

**Touches:** the refresh-token model (today: 30-day refresh tokens, multiple concurrent allowed, stored
hashed) — likely a `DeviceSession`/device-binding concept; `LoginCommandHandler` (issue + reconcile
sessions); client `AuthContext` (handle a "signed out elsewhere" 401); possibly a "manage devices" settings
screen. Needs careful UX + security tests (token revocation, race conditions).

> Explicitly out of scope for launch — captured here so it isn't lost.
