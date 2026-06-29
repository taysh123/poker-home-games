# 08 — File-by-File Implementation Plan (F)

Paths + responsibilities + reused patterns. **No code here** — the build map for the flag-gated Phase 0
implementation. Pure modules are TDD-first.

---

## A. Dependency & flag
| File | Action | Responsibility |
|---|---|---|
| `apps/poker-mobile/package.json` + `app.json` | modify | Add `expo-sqlite` (D1) + config plugin; native rebuild (EAS). |
| `src/config/features.ts` | modify | Add `content` (master) + `mastery` flags; OFF prod, ON dev/beta. |

## B. ContentStore (`src/content/`)
| File | Action | Responsibility / reuse |
|---|---|---|
| `types.ts` | create | `Pack`, `Manifest`, `SchemaColumn`, `IngestResult`, query result types (03). |
| `validate.ts` | create (pure, tested) | The 5 validation rules (06 §1): enum/required/FK/verification/hash + structural. Errors block; soft-FK warnings. |
| `schemaGen.ts` | create (pure, tested) | `schema[]` → `CREATE TABLE` DDL (04 §1): type map, CHECK, hard FK. |
| `db.ts` | create | expo-sqlite adapter: open `content.db`/`user.db`, exec, parameterized bulk insert, transactions, WAL. |
| `contentStore.ts` | create | Orchestrate ingest→validate→DDL→insert→atomic swap; quarantine; write-queue; `content_meta`/`ingested_packs`. Mirrors `localGamesStore.ts`. |
| `migrate.ts` | create | Schema-version migration chain. |
| `queries.ts` | create | Typed read API (05 §5). |
| `bundle.ts` | create | Locate + read bundled pack assets (`assets/content/<version>/`) via `expo-file-system`/`expo-asset`. |
| `context/ContentContext.tsx` | create | `useContent()` provider; bootstrap (06 §3); mounted in `App.tsx` (flag-gated). |

## C. Bundled content assets (published by content team — D2)
| Item | Action | Responsibility |
|---|---|---|
| `apps/poker-mobile/assets/content/<dataset_version>/*.pack.json` | add (vendored) | The published per-sheet packs (02). **Produced by the content team's exporter, not the app.** |
| `apps/poker-mobile/assets/content/<dataset_version>/coach_grounding.json` | add (vendored) | Published coach grounding (03 §3). |
| CI validation step | create | Run `validate.ts` rules over the vendored set at build; fail on errors. |

## D. Consumers
| File | Action | Responsibility |
|---|---|---|
| `src/features/study/state/StudyContext.tsx` | modify (additive) | Ranges from ContentStore when `content` ON; fallback `STARTER_DATASET`. |
| `src/features/study/ui/LessonReaderScreen.tsx` | create | Render `lesson_content` by ModuleID/SectionOrder as **Markdown** (D4). |
| `src/features/study/ui/ModulesScreen.tsx` | create | Modules/tracks/paths browse. |
| `src/features/study/ui/QuizRunnerScreen.tsx` | create | Authored quizzes (catalog/collections/objectives); RNG sampler stays fallback. |
| `src/features/study/ui/PostflopTreeScreen.tsx` | create | Node/action/sizing navigation. |
| `src/features/coach/data/groundingStore.ts` + `logic/grounding.ts` | create (pure, tested) | Load coach grounding; serve `safe_to_assert` only; always return `assertion_template`. |
| `src/features/premium/logic/contentAccess.ts` | create | `useContentAccess(asset)` = `has()` ∘ `content_access_map` ∘ row `FreeOrPremium`. |
| `src/features/premium/ui/PackCatalogScreen.tsx` | create | Storefront; show `pack_manifests.MarketableAs`; enforce ≥95% GTO gate. |
| `src/features/diagnostics/*` | create | Leak finder (run `DetectionLogic`) + remediation paths. |

## E. Analytics & mastery
| File | Action | Responsibility |
|---|---|---|
| `src/utils/analyticsContract.ts` | create (pure, tested) | Map app `track()` events → EV-01..11 with `RequiredFields`; route to 9 ExportTables. |
| `src/utils/analytics.ts` | modify | Implement `dispatch()` via a vendor-neutral adapter (D5); call sites unchanged. |
| `src/analytics/sink.ts` | create | Local SQLite sink (writes fact/dim rows) + flush hook for a future remote adapter. |
| `src/features/mastery/logic/mastery.ts` | create (pure, tested) | MM-01..05 engine (thresholds + decay + states), exact to `Mastery_Model`. |
| `src/features/mastery/state/MasteryContext.tsx` + `data/masteryStore.ts` | create | Compute from emitted events; persist `mastery_*` in `user.db`. |

## F. Tests (TDD targets, existing jest globs)
`validate.ts` (each rule incl. `Solver-Verified⇒SolveConfigID`, hash, soft-FK warning), `schemaGen.ts`
(enum→CHECK, hard-FK only), `grounding.ts` (**never serves `safe_to_assert=false` as fact**),
`analyticsContract.ts` (event→table + RequiredFields), `mastery.ts` (MM thresholds/decay), ContentStore
round-trip + quarantine (mirror `localGamesStore.test.ts`).

## G. Backend (Phase 0: none required)
Bundle-first needs no backend. Future (out of Phase 0): `/api/content/index|{id}`, server `ICoachAiProvider` +
`KnowledgeStore`. Documented for continuity; not built now.
