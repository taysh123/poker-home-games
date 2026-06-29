# 04 — File-by-File Implementation Plan

Exact files to add/modify, their responsibilities, and the existing pattern each reuses. **No code in this
document** — this is the build map for a future, flag-gated implementation. Nothing here is implemented now.

> Prerequisite: the **export set** (JSON packs), the **exporter**, and `TPoker_coach_grounding.json` must exist
> (see §Build/CI and 06 R1) before app code can ingest anything real. Until then, a single bundled pack derived
> from the existing `STARTER_DATASET` can drive the plumbing.

---

## A. Plumbing & flag
| File | Action | Responsibility / reuse |
|---|---|---|
| `src/config/features.ts` | modify | Add `content` flag (OFF prod, ON beta/dev — same pattern as `immersive`/`study`). Gates everything below. |
| `app.json` / EAS | modify (only if D-1 = sqlite) | Add `expo-sqlite` plugin + native rebuild. |

## B. Content store (the core)
| File | Action | Responsibility / reuse |
|---|---|---|
| `src/content/types.ts` | create | Pack envelope + manifest types mirroring the workbook `Export_Contract` (`manifest`, `schema[]`, `rows[]`). |
| `src/content/validate.ts` | create | Pure validators: enum membership, required present, FK resolves, `Solver-Verified ⇒ SolveConfigID`, SHA-256 `content_hash` recompute. Unit-tested. |
| `src/content/db.ts` | create | Storage adapter. **D-1**: expo-sqlite (schema→`CREATE TABLE`, `allowed`→CHECK, `fk`→FK) *or* file-backed JSON + in-memory indexes. |
| `src/content/contentStore.ts` | create | Ingest → validate → store → query; versioned load + migrate + **quarantine** + write-queue (mirror `src/local/localGamesStore.ts`). Records ingested `dataset_version`. Single source for all consumers. |
| `src/content/ingest.ts` | create | Orchestrates bundled-pack ingest on first run + (later) server pulls. |
| `src/context/ContentContext.tsx` | create | Thin provider exposing `useContent()` (status, query helpers, `refresh`). Mounted in `App.tsx` under existing providers. |
| `src/api/contentApi.ts` | create (Phase 3+) | `GET /api/content/index|{id}` via `apiClient` (bearer, 401-refresh); signed-URL blob download; only for server-delivered/premium updates. |

## C. Lessons & curriculum
| File | Action | Responsibility |
|---|---|---|
| `src/features/study/ui/LessonReaderScreen.tsx` | create | Render `Lesson_Content` by `ModuleID` ordered by `SectionOrder` (`Heading`+`BodyText`). Layout/typography only. |
| `src/features/study/ui/ModulesScreen.tsx` (or extend `StudyScreen`) | modify | Browse `Learning_Modules`/`Learning_Tracks`/`Certification_Paths` from the ContentStore. |
| `src/navigation/AppNavigator.tsx` | modify | Add lesson/module/quiz/pack routes (flag-gated). |

## D. Ranges, quizzes, postflop
| File | Action | Responsibility |
|---|---|---|
| `src/features/study/state/StudyContext.tsx` | modify | When `content` ON, source ranges from ContentStore; **fall back to `STARTER_DATASET`** when OFF/empty. Reuse `RangeDoc`/`buildTrainerHand`/`evaluateSpot`. |
| `src/features/study/ui/QuizRunnerScreen.tsx` | create | Run authored `Quiz_*` (objectives, collections, difficulty); RNG sampler remains the fallback. |
| `src/features/study/ui/PostflopTreeScreen.tsx` | create | Navigate `Postflop_Nodes`/`_Node_Actions`/`_Sizing_Sets`. |

## E. Coach grounding
| File | Action | Responsibility |
|---|---|---|
| `src/features/coach/data/groundingStore.ts` | create | Load/parse `TPoker_coach_grounding.json`; index by concept; **expose only `SafeToAssert=Yes` as fact**. |
| `src/features/coach/logic/grounding.ts` | create | Pure retrieval/ranking; always returns the `AssertionTemplate`. Unit-tested (no ungrounded leakage). |
| `src/features/coach/providers/serverCoachProvider.ts` + state | modify | Wire grounded provider path; client lookup for instant "why". |
| Backend `ICoachAiProvider` impl + `KnowledgeStore` | create (server) | Server-side grounding from ingested packs; commercial IP/vendor key stay server-side. |

## F. Analytics & mastery
| File | Action | Responsibility |
|---|---|---|
| `src/utils/analyticsContract.ts` | create | Map app `track()` events → the 11 `Analytics_Events` with `RequiredFields` + content-ID refs (table in 03 §2). |
| `src/utils/analytics.ts` | modify | Implement `dispatch()` to forward to the chosen provider (D-5); keep call sites unchanged. |
| `src/features/mastery/logic/mastery.ts` | create | Pure `Mastery_Model` engine (objective/concept/pack/track/certification thresholds + decay + states). Unit-tested. |
| `src/features/mastery/state/MasteryContext.tsx` + `data/masteryStore.ts` | create | Persist mastery (versioned store, mirror `studyStore`); compute from emitted events. |

## G. Commerce / gating
| File | Action | Responsibility |
|---|---|---|
| `src/features/premium/logic/contentAccess.ts` | create | `useContentAccess(packId)` = `has()` ∘ `Content_Access_Map`. |
| `src/features/study|premium/ui/PackCatalogScreen.tsx` | create | List packs; show `Pack_Manifests.marketable_as`; enforce ≥95% "GTO/Verified" gate; `PremiumGate` for locked. |

## H. Build / CI (prerequisite)
| Item | Action | Responsibility |
|---|---|---|
| `tools/content-export/` (or vendored packs) | create/obtain | Run the workbook **exporter** to produce versioned JSON packs + `TPoker_coach_grounding.json`; place under `apps/poker-mobile/assets/content/<dataset_version>/` for bundling. **Exporter/packs are not in-repo (06 R1).** |
| `apps/poker-mobile/assets/content/…` | create | Bundled "Expert Calibrated" export set (free + calibrated). `expo-asset`/`expo-file-system` load at first run. |
| CI check | create | Re-run pack validation (the same `validate.ts` rules) at build; fail on hash/FK/enum errors. |

## I. Tests (TDD targets)
Pure modules first: `validate.ts` (hash/FK/enum), `grounding.ts` (SafeToAssert never leaks), `mastery.ts`
(thresholds/decay), `analyticsContract.ts` (event mapping + RequiredFields). Then store round-trip + quarantine
(mirror existing store tests). All under the existing jest globs.
