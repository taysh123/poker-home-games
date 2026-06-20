# 05 — Migration Plan

Phased, **flag-gated, additive, reversible** rollout from today's static `STARTER_DATASET` to full 0.8.0
consumption. Production behavior is unchanged until the `content` flag flips; rollback at any phase = flag OFF.

---

## Pre-req (Phase −1): obtain the export set
Produce/obtain the JSON packs + `TPoker_coach_grounding.json` from the workbook via the exporter (06 R1). Until
this exists, a bundled pack derived from `STARTER_DATASET` drives plumbing only.

## Phase 0 — Ingest plumbing (behind `content`)
Land `content/types|validate|db|contentStore|ingest.ts` + `ContentContext` + the `content` flag. Ingest a single
**bundled** pack; validate (hash/FK/enum); store; record `dataset_version`. No UI consumes it yet. Reuses the
`localGamesStore` versioned+quarantine+write-queue pattern. **Prod OFF.**

## Phase 1 — Lessons
`LessonReader` + module/track navigation reading `Lesson_Content` from the ContentStore. First user-visible
content. **Prod OFF** (beta/dev preview).

## Phase 2 — Ranges / trainer / postflop
`StudyContext` sources ranges from the ContentStore when `content` ON, **falling back to `STARTER_DATASET`**.
Add authored `QuizRunner` (RNG sampler remains fallback) and the postflop tree viewer. Existing
`buildTrainerHand`/`evaluateSpot` unchanged. **Backward compatible.**

## Phase 3 — Coach grounding
Load `TPoker_coach_grounding.json`; enforce `SafeToAssert=Yes`; render `AssertionTemplate`. Client "why" lookup
+ server grounded `ICoachAiProvider`/`KnowledgeStore`. Demo label removed only when a real grounded provider is
selected. **No client contract change.**

## Phase 4 — Analytics contract + mastery
Add `analyticsContract.ts` mapping to the 11 events + `RequiredFields`; implement `dispatch()` provider; build
the `Mastery_Model` engine + store computing from emitted events. **App emits; workbook stores no user data.**

## Phase 5 — Premium packs + gating
Pack catalog + `useContentAccess()` + `Content_Access_Map`; display `marketable_as`; enforce the ≥95%
"GTO/Verified" gate. Optionally stand up `/api/content/*` for server-delivered/premium updates (else
bundled-first). **Honest labeling enforced.**

## Phase 6 — Solver-verified re-export (no app change)
External solver runs → `solver_import.py` → re-export with upgraded `VerificationTier`/`marketable_as` + bumped
`dataset_version`. The app re-ingests; labels/packs upgrade automatically. **Zero code change** — the
architecture absorbs it by design.

---

## Rollout / rollback
- Each phase: ON in dev/beta → soak → (later, out of scope) prod via `content`.
- **Rollback** = `content` OFF → ContentStore inert → Study uses `STARTER_DATASET` → **exactly today's app**.
- Record the ingested `dataset_version`; on a content bump, re-validate + re-ingest; quarantine on any failure
  (never serve a bad version).

## Backward-compatibility checklist
- `STARTER_DATASET` remains the offline/fallback range source throughout.
- New providers (`ContentContext`, `MasteryContext`) are additive; absent → today's behavior.
- `track()` call sites unchanged (mapping layer is additive).
- `RangeDoc` is compatible with the current trainer; no consumer rewrite.
- Honest verification posture preserved (no "GTO/Verified" until the gate passes).
