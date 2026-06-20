# 06 — Migration Plan: STARTER_DATASET → Commercial Dataset

**Deliverable 6.** The phased, flag-gated, reversible path from today's single bundled `STARTER_DATASET` to a
hybrid commercial content system — with **production behavior unchanged until a flag flips**.

---

## 1. Principles
- **Additive + reversible.** Every phase ships OFF in production; the current Study/Coach behavior is the
  fallback. Mirrors the existing flag switchboard (`src/config/features.ts`) and resolution order
  (PROD → BETA → DEV).
- **One seam at a time.** Land the abstraction before the source, the source before the gate.
- **Never break the free path.** The bundled starter remains the guaranteed offline experience throughout.
- **Backward compatible.** `RangeDataset.schemaVersion: 1` and the current `STARTER_DATASET` stay valid; new
  shapes are additive supersets.

## 2. New feature flag
Add `content` to `FeatureFlag` (`src/config/features.ts`) — OFF in `PROD_FLAGS`, ON in `BETA_FLAGS`/
`DEV_OVERRIDES` for preview (same pattern as `immersive`, `study`, etc.). All work below is gated by it.

## 3. Phases

### Phase 0 — Schema + docs (this task)
- These documents + JSON Schemas land. **No app/backend code changes.** Production untouched.

### Phase 1 — Content-source abstraction (the loader seam)
- Introduce a `ContentRepository`/`loadDataset()` indirection. `StudyContext` reads its `dataset` from the
  repository instead of importing `STARTER_DATASET` directly.
- Initial repository implementation simply **wraps the bundled starter** (re-expressed as a free `ContentPack`)
  → behavior identical. This is the swap point for everything later.
- Reuse the `studyStore`/`localGamesStore` versioned-load + quarantine pattern for any persisted state.
- **Reversible:** with `content` OFF, the repository returns exactly `STARTER_DATASET`.

### Phase 2 — `RangeDataset`/`RangeDoc` v2 (lift hardcoded assumptions, additively)
- Extend authoring to support `tableSize ∈ {9,6,2,…}`, multiple `stackBb`, `format: 'mtt'`, and additional
  `scenario` strings (`3bet`, `vs_3bet`, …) — all already representable in the types; only the `cash100()`
  authoring helper + a couple of `optionsForScenario`/prompt branches need additive extension.
- Bump `schemaVersion` only if a breaking change is required; otherwise additive within v1. Add a migration step
  to the chain when bumped.
- Trainer/quiz consumers already read these fields generically (`generateSpot`, `evaluateSpot`,
  `buildTrainerHand`) — no consumer rewrite.

### Phase 3 — Server delivery + cache (behind `content`)
- Add `GET /api/content/index` + signed per-pack download (backend) following existing API conventions.
- Add the client `contentApi` + `tpoker.content.v1` cache (mirror `localGamesStore`: verify → migrate →
  quarantine; write-queue). Lazy, entitlement-aware download ([02](02-import-pipeline-design.md), [04](04-content-pack-specification.md)).
- Free starter still bundled; cached commercial packs merge on top.

### Phase 4 — Premium gating + new consumers
- Wire `useContentAccess(packId)` over `EntitlementsContext.has()`; wrap commercial content in `PremiumGate`
  (`advanced_gto` / `premium_learning`); surface upgrade via the existing `paywall` flow.
- Add the new content-type consumers: lesson reader, authored quiz runner (RNG sampler remains the fallback),
  learning-path runner — all reading from the repository.

### Phase 5 — Coach grounding (server)
- Ingest packs into the server `KnowledgeStore`; add retrieval + a grounded `ICoachAiProvider`
  ([05](05-coach-knowledge-integration.md)). Client unchanged; demo label removed only when a real grounded
  provider is selected.

### Phase 6 — Commercial import + starter becomes the free tier
- Run the import pipeline ([02](02-import-pipeline-design.md)) on the finalized workbook → publish packs.
- `STARTER_DATASET` is re-labeled as the **free** `ContentPack`; commercial packs are premium. No code change —
  just content + entitlement config.

## 4. Rollout / rollback
- Each phase flips on first in DEV/BETA, soak-tests, then (much later, out of this scope) PROD via the flag.
- **Rollback at any phase** = flag OFF → repository returns the bundled starter → exactly today's behavior.
- Server content rollback = repoint the index to a prior pack version (no app release).

## 5. Backward compatibility checklist
- Old persisted study progress (`tpoker.study.v1`) keeps loading (defensive merge already in `studyStore`).
- Old app versions ignore packs with a higher `minAppVersion` and skip unknown content types/fields
  (tolerant schemas, [03](03-json-schema-specification.md) §Versioning).
- `RangeDoc` is a superset of `PreflopRange` → existing trainer/quiz/`buildTrainerHand` work unmodified.

## 6. Explicitly out of scope (now)
No flag, abstraction, endpoint, cache, consumer, or coach grounding is implemented in this task. This is the
sequence to follow when the workbook is ready. Until Phase 1+ ships behind `content`, **production is byte-identical.**
