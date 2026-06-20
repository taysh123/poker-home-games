# 05 — Verification & Rollback (F, G)

---

## F. Verification strategy

### Per-phase Definition of Done (gate to merge)
Every phase: `npx tsc --noEmit` clean · `npx jest` green **with the new path in `testMatch`** ·
`npx expo export -p web` succeeds (web JSON backend, OD-1) · honesty tests present + passing · manual smoke on a
dev-client **flag ON** + regression smoke **flag OFF** (today's app unchanged). Content phases add: ingest
round-trip + quarantine test + `dataset_version`/hash recorded.

### Test layers
- **Pure/unit (jest, no native):** `validate`, `schemaGen`, `hash`, `quizRunner`, `grounding`,
  `analyticsContract`, `mastery`, `contentAccess`, `marketableLabel`.
- **Store integration (jest via in-memory backend):** `contentStore` ingest→validate→query→quarantine→rollback.
- **Native (dev-client / Detox / manual):** `db.native.ts` real sqlite round-trip; first-run bootstrap.
- **Build:** web export per phase; EAS dev-client boot for the dep PR.

### Honesty tests (mandatory, snapshotted)
- **SafeToAssert:** property test over all 95 `coach_grounding` rows — only `SafeToAssert=Yes` is served as
  fact; every path returns `AssertionTemplate`; a guard test that UI imports go through the single seam.
- **GTO ≥95% gate:** `marketableLabel` snapshot truth table of all 17 packs — only Push/Fold carries "GTO";
  every scope <95% returns a non-GTO/non-"Verified" string. Re-run on every `dataset_version`.
- **No false Solver-Verified:** `validate` blocks `Solver-Verified` with empty `SolveConfigID`; a **vacuous-0
  lock** asserts ingest of the real set yields 0 Solver-Verified rows today.
- **Idempotency:** double-flush of the same `event_id` inserts once; mastery recompute is stable.

### Fixture strategy (before D2 delivers real packs)
A **STARTER_DATASET-derived** fixture pack (plumbing) + a **large synthetic** pack (scale/jank, ~5k rows) + a
**deliberately-broken** pack (bad hash, enum violation, dangling hard FK, `Solver-Verified` w/o `SolveConfigID`)
to prove validation/quarantine/recovery. `content_hash` computed by the **same `hash.ts`** the validator uses.
Fixtures marked non-production (CI guard prevents bundling).

### Cross-check (this plan vs source of truth) — done
Dependency chains, workbook mappings, export contract envelope, SQLite mappings, flag strategy, and rollout
sequence verified against the workbook + Phase 0 docs; the jest-glob gap verified in `jest.config.js`. All ids
real (EV-01..11, MM-01..05, PACK-01..17, the `VerificationTier`/`Status`/`SafeToAssert` enums).

## G. Rollback strategy
- **Feature flag (primary):** `content`/`mastery`/`coach`/`paywall` OFF ⇒ that surface reverts; `content` OFF ⇒
  ContentStore never initialized ⇒ Study uses `STARTER_DATASET` ⇒ **byte-identical to today** (lazy-init +
  boot test enforce this).
- **Content rollback:** ingest is a whole-store **staging swap**; the **prior content store is retained**, so
  `rollback(version)` restores the last good `dataset_version`. Server content (future) rolls back by
  re-pointing the index — no app release.
- **Two-store isolation:** the **user store is never touched** by upgrade or rollback → telemetry/mastery/streaks
  survive any content change (enforced by a test asserting only content tables are dropped/swapped).
- **Bad pack:** quarantined; prior/bundled good version keeps serving (`degraded`), never clobbered.
- **Per-PR:** every PR is independently revertable (additive, flag-gated); no PR changes existing screens or the
  backend in Phases 0–5.
