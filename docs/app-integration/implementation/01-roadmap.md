# 01 — Roadmap & Phase-by-Phase (A, B, H)

Six phases, each with the 10-item template. Execution order + milestones at the end. Flag-gated, additive,
reversible throughout (`content` master flag; OFF = today's app).

---

## Phase 1 — Content Infrastructure
1. **Objectives:** On-device content store consuming published packs (D2): ingest → validate → store → query,
   with versioning, rollback, two-level gating primitive, and flags. Backend-agnostic (native sqlite / web JSON).
2. **Dependencies:** `expo-sqlite`, `react-native-markdown-display` (added PR #1); the published pack contract
   (Phase 0 docs 02/03); content_hash recipe (06 #3).
3. **Risks:** hash mismatch → mass quarantine; FK-referenced-table swap; web backend parity; flag-OFF not
   byte-identical; native dep/EAS friction. (04 R1–R7.)
4. **Architecture impact:** new `src/content/` layer + `ContentContext` provider (mounted inside
   `EntitlementsProvider`, above Study/Coach); new `mastery`/`content` flags; **no** change to existing screens.
5. **Files affected:** `src/config/features.ts`, `App.tsx` (provider mount), `jest.config.js`, `package.json`,
   `app.json`.
6. **New files:** `src/content/{types,validate,schemaGen,db(native),db.web(in-memory),contentStore,migrate,queries,bundle}.ts`,
   `src/context/ContentContext.tsx`, `src/features/premium/logic/contentAccess.ts`, fixture packs under `src/content/__tests__/fixtures/`.
7. **Order:** deps+flags+globs (PR #1) → backend adapter + `validate`+`schemaGen` (pure) → `contentStore`
   (staging swap + quarantine) → `queries` → `ContentContext` (lazy bootstrap) → `contentAccess`.
8. **Verification:** unit tests (validate rules incl. broken-pack quarantine, schemaGen DDL incl. composite PK,
   hash helper) + store round-trip against the **in-memory backend**; `tsc`/`jest` green; web export OK; native
   smoke on dev-client. (05.)
9. **Rollback:** `content` flag OFF ⇒ ContentStore never initialized ⇒ `STARTER_DATASET` fallback; prior content
   store retained for `rollback(version)`; user store untouched.
10. **DoD:** ingest→validate→query green on STARTER/large/broken fixtures; flag OFF = byte-identical app
   (boot test); hash helper pinned by a cross-language fixture; `contentAccess` truth-table tested.

## Phase 2 — Learning System (first user-visible)
1. **Objectives:** Render canonical curriculum: Lesson Reader, Modules/Tracks, Study Plans, Quiz Engine,
   Certification support.
2. **Dependencies:** Phase 1 (ContentStore + queries + Markdown); export-sets `curriculum`, `quizzes`, `study`.
3. **Risks:** Markdown × web/reanimated; quiz state machine; nav mounting in both trees; large `quiz_catalog`.
4. **Architecture impact:** new study screens; `StudyContext` additive switch to ContentStore ranges (fallback
   `STARTER_DATASET`); routes in **both** guest+authed stacks.
5. **Files affected:** `src/features/study/state/StudyContext.tsx`, `src/navigation/AppNavigator.tsx`,
   `src/features/study/ui/StudyScreen.tsx`.
6. **New files:** `src/features/study/ui/{LessonReaderScreen,ModulesScreen,QuizRunnerScreen,PostflopTreeScreen}.tsx`,
   `src/features/study/logic/quizRunner.ts` (pure).
7. **Order:** Lesson Reader (read-only) → Modules/Tracks → Quiz Engine → Study Plans → Certification.
8. **Verification:** `quizRunner` unit tests; lesson render snapshot; web export; manual smoke both nav trees.
9. **Rollback:** flag OFF hides new routes; `StudyContext` reverts to `STARTER_DATASET`.
10. **DoD:** lessons render Markdown by `ModuleID`/`SectionOrder`; quizzes graded vs authored content; RNG
   fallback intact; flag OFF unchanged.

## Phase 3 — Coach System
1. **Objectives:** Ground the coach in `TPoker_coach_grounding.json`; enforce `SafeToAssert`; retrieval; integrate.
2. **Dependencies:** Phase 1 (or standalone JSON load — grounding needs no sqlite, works on web); coach export-set.
3. **Risks:** **ungrounded-claim leakage** (reputational); client/server seam.
4. **Architecture impact:** new grounding loader + a **single** serving seam; existing `ICoachProvider` contract
   unchanged.
5. **Files affected:** `src/features/coach/state/CoachContext.tsx`, `providers/serverCoachProvider.ts`.
6. **New files:** `src/features/coach/data/groundingStore.ts`, `src/features/coach/logic/grounding.ts` (pure).
7. **Order:** loader → `grounding.ts` (SafeToAssert) → coach integration → (later) server `KnowledgeStore`.
8. **Verification:** property test over all 95 CG rows — **never** serve `SafeToAssert≠Yes` as fact; always
   return `AssertionTemplate`; single-seam guard.
9. **Rollback:** `coach` flag / grounding source absent ⇒ today's mock path.
10. **DoD:** grounding served only when safe; demo label rules honored; cross-platform (web JSON works).

## Phase 4 — Premium Content
1. **Objectives:** Pack Catalog + entitlement integration + two-level gating + access control.
2. **Dependencies:** Phase 1 (`contentAccess.ts`, `pack_manifests`/`content_access_map`/`premium_content_catalog`).
3. **Risks:** **GTO/Verified mislabeling** (only Push/Fold qualifies today); gating leak.
4. **Architecture impact:** Pack Catalog screen; gating composes `EntitlementsContext.has()`.
5. **Files affected:** `src/navigation/AppNavigator.tsx`, premium UI.
6. **New files:** `src/features/premium/ui/PackCatalogScreen.tsx`, `src/features/premium/logic/marketableLabel.ts`.
7. **Order:** `marketableLabel` (gate) → catalog → gating wiring → access control on all consumers.
8. **Verification:** snapshot truth table of all 17 packs’ labels; ≥95% gate test; gating truth table (fail-closed).
9. **Rollback:** `paywall`/`content` flag OFF reverts UI; access defaults closed.
10. **DoD:** `MarketableAs` shown verbatim; no "GTO/Verified" below 95%; two-level gating enforced.

## Phase 5 — Analytics + Mastery
1. **Objectives:** Emit the 11 contract events; vendor-neutral dispatch; Mastery engine (MM-01..05); progress +
   recommendation hooks.
2. **Dependencies:** Phases 1–2/4 (event sources); `analytics_events`/`mastery_model` contracts; user store.
3. **Risks:** dual taxonomy; **double-insert inflating mastery**; decay correctness.
4. **Architecture impact:** mapping layer over existing `track()`; new `src/features/mastery/`; `user` store
   fact/dim + mastery tables; `dispatch()` adapter.
5. **Files affected:** `src/utils/analytics.ts` (`dispatch()`), existing `track()` call sites (unchanged names).
6. **New files:** `src/utils/analyticsContract.ts`, `src/analytics/sink.ts`,
   `src/features/mastery/{logic/mastery.ts,state/MasteryContext.tsx,data/masteryStore.ts}`.
7. **Order:** contract mapping → sink (idempotent fact writes) → mastery projections → progress UI → recs.
8. **Verification:** EV-01..11 field-mapping tests (RequiredFields); MM-01..05 fixtures; idempotency
   (`INSERT OR IGNORE`) test; mastery-as-projection test (re-flush safe).
9. **Rollback:** `mastery` flag OFF; analytics buffer/no-op `dispatch()` as today.
10. **DoD:** events carry RequiredFields → correct ExportTables; mastery recomputed deterministically; retries safe.

## Phase 6 — Solver Integration Foundation
1. **Objectives:** Verification display (tiers), readiness/`MarketableAs` surfacing, solver-import readiness,
   dataset upgrade handling — **no app change on re-export**.
2. **Dependencies:** Phases 1+4; `verification_coverage`/`verification_readiness`/`dataset_versions`.
3. **Risks:** implying verification that doesn't exist; upgrade/rollback handling.
4. **Architecture impact:** display-only verification badges; re-ingest path already in Phase 1.
5. **Files affected:** content display components; pack catalog.
6. **New files:** `src/features/study/ui/VerificationBadge.tsx`.
7. **Order:** badge/tier display → readiness surfacing → upgrade handling (re-ingest + rollback) verified.
8. **Verification:** badge reflects `VerificationTier`/`MarketableAs` exactly; **vacuous-0 Solver-Verified lock**;
   dataset bump → re-ingest test.
9. **Rollback:** content rollback to prior `dataset_version`; user store untouched.
10. **DoD:** honest tiers everywhere; a future solver re-export upgrades labels with **zero code change**.

---

## Recommended execution order (H)
**PR #1** infra config & deps → **PR #2** ContentStore core (fixtures) → **Phase 2** Lesson Reader (first
user-visible) → Modules/Quizzes → **Phase 3** Coach grounding → **Phase 4** Packs/gating → **Phase 5**
Analytics+Mastery → **Phase 6** Solver display. `contentAccess.ts`/`marketableLabel.ts` built in Phase 1/4 but
unit-tested from the start. Each step independently shippable behind its flag; `user` store durable across all.
