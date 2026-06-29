# 06 — Runtime Lifecycle: Versioning · Bootstrap · Recovery · Offline

Phase 0 foundation items 5–10: pack ingestion (05), **validation**, **content upgrade/versioning**, **startup
bootstrap**, **failure/recovery**, **offline-first**.

---

## 1. Validation architecture (item 6) — the gate
From `Export_Contract._validation`, enforced in pure `validate.ts` (errors block; warnings log):
1. **Enum membership** — every `allowed` column value ∈ its set (`VerificationTier`, `Status`, `SafeToAssert`, …).
2. **Required present** — every `required:Y` column non-null.
3. **FK resolves** — every **hard** FK target exists (ProvenanceID→source_map, SolveConfigID→solver_runs,
   ConceptID→coach_knowledge_map, ModuleID→learning_modules, postflop self-refs, PackID→premium_content_catalog).
   **Soft `(node)` links → warning only** (polymorphic/optional).
4. **Verification integrity** — `VerificationTier=Solver-Verified ⇒ SolveConfigID resolves` (prevents false
   "verified"). Today **0 rows are Solver-Verified**, so this is vacuously satisfied — and must stay honest.
5. **Hash** — recomputed SHA-256 over the sorted row body equals `manifest.content_hash`.
Plus structural: `row_count == manifest.row_count`; `Status ∈ {Published,Approved}` only (export rule).

## 2. Content upgrade / versioning (item 7)
- **Identity:** `dataset_version` (semver, e.g. `0.8.0`) + per-pack `content_hash`; recorded in `content_meta`
  + `ingested_packs`. The workbook changelog is `dataset_versions` (DSV-001..003 today; all additive,
  `BreakingChanges: None`).
- **Detect:** compare ingested `dataset_version`/hashes to the available set (bundled asset version, or future
  `index.json`). `isStale()` drives re-ingest.
- **Apply:** re-ingest only changed packs (hash differs); atomic per-pack swap (05). Bump `content_meta`.
- **Schema-version migration:** if a future pack changes structure, `migrate.ts` runs a chained migration
  (mirrors `migrateToCurrent`); unknown new columns/sheets are tolerated, not fatal.
- **Rollback:** keep the previous good content snapshot; `rollback(toVersion)` restores it (server content can
  also roll back by re-pointing `index.json` — no app release). **`user.db` is never touched** by upgrade or
  rollback, so mastery/telemetry survive.

## 3. Startup bootstrap sequence (item 8)
```
app launch
 → ContentStore.init()                       // open content.db + user.db; ensure meta; run pending migration
 → if content empty OR bundled dataset_version > ingested:
       ingestBundleSet()                      // ingest the bundled "Expert Calibrated" set (D3)
 → else: quick integrity check (content_meta hash present; spot-check a table)
 → mark ContentContext ready                 // consumers may now query
 → (optional, later) if online & server index newer: schedule background re-ingest
```
- Bootstrap is **flag-gated** (`content`): OFF → ContentStore stays inert and Study falls back to
  `STARTER_DATASET` (today's behavior).
- First-run ingest happens once; subsequent launches do only the cheap integrity check.

## 4. Failure / recovery (item 9)
| Failure | Behavior |
|---|---|
| Corrupt/invalid pack (any validation error) | `quarantine_log` the raw payload; **keep the prior/bundled good table**; continue `degraded`. |
| Hash/row-count mismatch | Treat as corrupt → quarantine; do not swap. |
| DB open/exec error | Retry once; if persistent, fall back to bundled set; surface a non-blocking notice. |
| Partial ingest (crash mid-transaction) | WAL + per-pack transaction → automatic rollback; table unchanged. |
| Bundled set itself bad (build error) | CI validation (08) prevents shipping; runtime guard falls back to `STARTER_DATASET`. |
- **Never** clobber a good version with a bad one; **never** drop `user.db`.

## 5. Offline-first (item 10)
- The **bundled "Expert Calibrated" set ships in the binary** (D3) → full content available with **no network**
  on first launch and forever after.
- Cached ingested content persists in `content.db`; queries are local SQLite (no network on the read path).
- Server delivery (future) is **additive**: background refresh when online; failures are silent and never
  degrade the offline experience.
- Analytics/telemetry buffer locally (existing `analytics.ts` buffer) and flush via the vendor adapter when
  online — emission never blocks UI.
