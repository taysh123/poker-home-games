# 06 — Subagent Review Synthesis (frontend · backend · data · product · QA)

Three parallel review agents (frontend+product, backend+data, QA+verification) audited the Phase 0 blueprint
against the real app. Below are their findings, the conflicts, and the resolutions now baked into this plan.
These refine the *app-side* Phase 0 design (docs 04/06/08); the workbook and content architecture are unchanged.

---

## Frontend + Product
**Findings:** (a) `ContentProvider`/`MasteryProvider` must mount inside `EntitlementsProvider`, above
`StudyProvider`/`CoachProvider` (else silent default-context bug). (b) **Web is a real surface** (Vercel) —
expo-sqlite has no first-class web path; "disable on web" silently drops new surfaces. (c) Screen-owned async
fetching conflicts with a blocking bootstrap; no skeleton spec. (d) New screens must mount in **both** nav trees
(guest + authed). (e) No Markdown renderer exists. (f) Product: first user-visible milestone should be the
**Lesson Reader** (read-only, no entitlement/quiz state); split the expo-sqlite dep into its own PR; build the
tiny `contentAccess.ts` gating primitive early.
**Resolutions:** provider order pinned (02/03); **OD-1 resolved → web in-memory JSON backend** (parity, no
sqlite on web); lazy non-blocking bootstrap + `isLoaded` skeletons (reuse `SkeletonCard/Row/Shimmer`); two-tree
mounting noted per screen; `react-native-markdown-display` chosen (D4); first milestone = Lesson Reader; dep PR
isolated (PR #1); `contentAccess.ts` in Phase 1.

## Backend + Data
**Findings:** (a) `SolveConfigID→solver_runs` is a hard FK to a **non-ingested** table. (b) Per-table
drop/rename swap breaks **FK-referenced** tables (`learning_modules`, `postflop_nodes`) and `PRAGMA
foreign_keys` is connection-scoped. (c) `content_hash` "over sorted rows" is **under-specified** (column order,
nulls, number/JSON encoding) → mass-quarantine risk. (d) Flat `content_meta` can't store a prior snapshot →
**rollback unimplementable**. (e) Fact tables lack idempotency → **double-insert inflates mastery**. (f) Two
DBs must be **two physical files**, not attached schemas, to guarantee user-data isolation. (g) Composite PKs
(`content_packs`, `schema_registry`) + array columns (`EvidenceNodeIDs`) need DDL handling. (h) expo-sqlite:
prefer two handles over ATTACH; WAL sidecar files; bulk insert in one tx; read bundled assets via
expo-file-system first.
**Resolutions:** `SolveConfigID` → soft/warning + value-check rule-4 (R3); **whole-store staging swap** + prior
retained for rollback (R4); shared `hash.ts` + cross-language fixture (R1); two physical stores, user store
durable (R-store boundary); `event_id` PK + `INSERT OR IGNORE`, **mastery as recomputed projection** (R7);
`schemaGen` handles composite PK + array/object→`TEXT(JSON)` (R15); native backend uses two handles + WAL +
batched prepared inserts.

## QA + Verification
**Findings:** (a) **`jest.config.js testMatch` excludes `src/content`/`src/analytics`** (verified) → tests
silently skipped; doc 08 §F "existing globs" claim false. (b) expo-sqlite won't load under jest-expo → keep the
native seam injected; in-memory backend for tests. (c) Need explicit honesty assertions (SafeToAssert, ≥95%
gate, Solver-Verified⇒SolveConfigID + vacuous-0). (d) Fixture-from-STARTER is sound but won't reproduce FK
density/scale → add large + broken fixtures; shared hash helper. (e) Flag-OFF "byte-identical" needs a
lazy-import assertion + dev-client/EAS boot check. (f) Per-phase DoD must include web export + honesty tests +
flag-OFF regression smoke.
**Resolutions:** fix globs in PR #1 + a proof test (R2); inject `backend.ts`, in-memory = jest backend (R10);
honesty tests + snapshots (05 §F); large+broken fixtures + shared hash (05); lazy-init + boot test (R8);
per-phase DoD codified (05 §F).

## Conflicts & how they were resolved
- **Web (OD-1):** Frontend flagged silent regression; Backend/QA recommended "disable on web". **User chose the
  in-memory JSON backend** — full web parity, no sqlite-on-web, and the in-memory backend conveniently doubles as
  the jest test backend (also resolving the QA "untestable native" concern). Single `ContentBackend`/`queries`
  interface keeps the two backends in lockstep (R9 mitigation: shared query tests run on both).
- **Ingest model:** Phase 0 doc said per-table rename swap; Backend showed it breaks referenced tables and
  blocks rollback. **Adopted whole-store staging swap** (atomic, rollback-capable) — supersedes doc 04/06 on
  this point.
- **FK spine:** Phase 0 listed `SolveConfigID` as a hard FK; Backend showed the target isn't ingested.
  **Adopted soft/warning** + value-check — supersedes doc 04 on this edge.
- **Test paths:** Phase 0 doc 08 claimed existing globs cover new tests; QA disproved it. **Adopted glob fix in
  PR #1** — corrects doc 08 §F.

No unresolved conflicts remain. All resolutions are reflected in 01–05 and the risk register (04).
