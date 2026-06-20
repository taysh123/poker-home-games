# 02 — Import Pipeline Design

**Deliverable 2.** How the commercial workbook becomes validated, versioned, signed **content packs**, how they
reach the device, and how they're kept fresh. Covers *content import architecture* + *future update strategy*.

> No part of this pipeline runs yet. This document defines the stages and their contracts so the content team
> and a future implementation phase have a fixed target.

---

## 1. Pipeline stages (build time → runtime)

```
 (A) Author        (B) Transform        (C) Validate        (D) Stamp+Sign      (E) Publish        (F) Deliver        (G) Ingest
 workbook/   ─►    normalize to    ─►   JSON Schema    ─►   semver+checksum ─►  upload to    ─►    index + signed ─►  download→verify
 source files      ContentPack          (draft 2020-12)     + signature        content store       URLs (gated)       →cache→migrate
```

### (A) Author
Source of truth is the commercial workbook (kept **outside** this repo until ready). Authors may write either:
- **Compact notation** for ranges (`'77+, AJs+'`) — same dialect the starter pack uses, or
- **Pre-expanded `HandStrategy`** (e.g., solver exports with mixed frequencies).

Lessons/quizzes/paths/knowledge are authored as structured docs (Markdown body + structured fields).

### (B) Transform (build-time CLI — `tools/content-cli`, future)
A Node CLI (no app dependency; lives under `tools/`, not `apps/`) that:
- Expands range notation → `HandStrategy` by **reusing the existing pure expander** (the logic in
  `apps/poker-mobile/src/features/study/logic/handGrid.ts buildStrategy()` / `expandRange()`), so authored and
  runtime expansion can never diverge. (Extract to a shared module or import directly.)
- Normalizes ids, locales, and references (a quiz/path references ranges/lessons by id; the CLI verifies every
  reference resolves within the pack).
- Emits one `ContentPack` JSON object per pack.

### (C) Validate
- Validate each emitted pack against the **JSON Schema** in [`schemas/`](schemas) (draft 2020-12).
- Semantic checks beyond schema: referential integrity (ids resolve), `entitlements[]` are known
  `PremiumFeatureKey`s, `HandStrategy` frequencies per hand sum to ≈1 (±1e-6), no duplicate ids.
- **Fail the build** on any error — invalid content never publishes.

### (D) Stamp + sign
- Stamp `manifest.version` (content **semver**) and `manifest.schemaVersion` (shape version).
- Compute `manifest.checksum` = SHA-256 of the canonicalized pack body (excluding the checksum field itself).
- Sign the checksum with a release key; store the signature in the manifest (`manifest.signature`). The device
  verifies checksum on download and (optionally) signature to reject tampered/corrupt packs.

### (E) Publish
- Upload packs to the content store (object storage/CDN). Update the server-side **index** the app reads.
- Publishing is **atomic per version**: a new version is a new immutable object; the index points at the
  current version. Rollback = repoint the index at the previous version (no client redeploy).

### (F) Deliver (server endpoints — future, follow existing API conventions)
Reuse the transport conventions from `apps/poker-mobile/src/api/apiClient.ts` (bearer auth, 401 auto-refresh)
and the per-resource api-file pattern. Proposed endpoints:

| Endpoint | Purpose | Gating |
|----------|---------|--------|
| `GET /api/content/index` | List available packs + current versions + `entitlements[]` + checksum | Auth required; server filters/marks packs by the caller's entitlement |
| `GET /api/content/{packId}` | Resolve a **short-lived signed download URL** (+ metadata) for one pack version | Server re-checks entitlement before issuing the URL (defense in depth) |

The signed URL points at the CDN object; the large body is fetched directly (not through the JSON `apiClient`),
mirroring the audit's recommended blob-download approach.

### (G) Ingest (device — mirror `src/local/localGamesStore.ts`)
```
download body → verify checksum (+signature)  → parse JSON → schema/shape guard
   ├─ ok                → migrateToCurrent() → write to cache (tpoker.content.v1) → available
   └─ corrupt/mismatch  → quarantine raw (tpoker.content.quarantine.<ts>) → keep prior good version
```
- **Never overwrite a good cached pack with a bad download.** On any failure, the previously cached version (or
  the bundled starter) remains active.
- Writes are serialized with the existing write-queue pattern (see `LocalGamesContext`/`StudyContext`).

---

## 2. The `ContentRepository` (runtime, future)

A small client module that is the **single source of content** for all consumers — the seam that replaces the
static `STARTER_DATASET` import:

```ts
// shape only — illustrative, not implemented here
interface ContentRepository {
  // Bundled free starter is always present; cached/active packs merge on top (by entitlement).
  ranges(): RangeDoc[];
  lessons(): LessonDoc[];
  quizzes(): QuizDoc[];
  paths(): LearningPathDoc[];
  // Lifecycle
  refreshIndex(token: string): Promise<void>;     // GET /api/content/index
  ensurePack(packId: string, token: string): Promise<void>; // download+verify+cache if entitled & stale
  status(packId: string): 'bundled' | 'cached' | 'available' | 'locked' | 'updating';
}
```

`StudyContext` (and new lesson/quiz/path runners) read from this repository instead of importing a constant.
See [06](06-migration-plan.md) for the phased swap.

---

## 3. Future update strategy

- **Index polling, not push.** On app focus / Study-tab open (cheap), call `GET /api/content/index` at most
  once per interval; compare each pack's current `version` to the cached version.
- **Lazy, entitlement-aware download.** Only download a pack when (a) the user is entitled and (b) it's
  stale/missing and (c) the user enters a surface that needs it. Free starter needs no download.
- **Version bump → re-download** the new immutable version; verify checksum; atomically swap the active version
  in the cache; quarantine the old only if the new verifies.
- **Cache invalidation** is version-keyed (immutable versions), so stale reads are impossible once swapped.
- **Rollback** is server-side (repoint index) — clients converge on next poll; no app release needed.
- **`minAppVersion`** in the manifest lets a pack require a newer app; older apps ignore packs they can't render
  (forward-compatible: unknown content types/fields are skipped, never fatal — see [03](03-json-schema-specification.md) §Versioning).
- **Offline:** last-good cached packs + bundled starter remain fully usable with no network.

## 4. What this pipeline deliberately does **not** do (now)
- It does not import or transform any real workbook content (the workbook isn't ready).
- It does not add the CLI, endpoints, repository, or cache to the app/backend — those are future phases gated by
  a `content` flag ([06](06-migration-plan.md)).
- It does not change how the current trainer/quiz behave.
