# 02 — File-by-File Execution Plan (C)

Exact folders, files, ownership, responsibilities, interfaces. **No code** — the execution map. Pure modules are
TDD-first; native seams are injected so logic stays testable.

---

## Reuse / Refactor / Untouched (summary)
- **Reuse (pattern):** `src/local/localGamesStore.ts` (versioned + quarantine + write-queue) → ContentStore;
  `SkeletonCard/Row/Shimmer` → content loading; `EntitlementsContext.has()`/`PremiumGate` → gating;
  `utils/analytics.ts track()` → contract mapping; `ICoachProvider` seam → grounding; `expo-file-system` → assets.
- **Refactor (additive only):** `features/study/state/StudyContext.tsx` (source ranges from ContentStore,
  `STARTER_DATASET` fallback); `App.tsx` (mount Content/Mastery providers); `utils/analytics.ts` (`dispatch()`);
  `jest.config.js` (globs); `config/features.ts` (flags).
- **Untouched:** sessions/groups/bankroll/tournament screens, auth, backend (.NET) for Phase 0–5; existing
  `track()` call-site names; `STARTER_DATASET` (kept as fallback).

## `src/content/` — ContentStore (owner: platform/infra)
| File | Responsibility | Interface (sketch) |
|---|---|---|
| `types.ts` | Pack/manifest/schema/result types | `Pack`, `Manifest`, `SchemaColumn`, `IngestResult` |
| `validate.ts` (pure) | 5 validation rules + structural | `validate(pack): {errors[],warnings[]}` |
| `schemaGen.ts` (pure) | schema→DDL / table spec (composite PK, CHECK, hard FK, array/obj→JSON) | `tableSpec(schema): TableSpec` |
| `hash.ts` (pure) | byte-exact canonical row hash (shared w/ fixtures) | `contentHash(rows, schema): string` |
| `backend.ts` | `ContentBackend` interface | `createTable/insert/swap/query/tx` |
| `db.native.ts` | expo-sqlite backend (2 files, WAL, prepared stmts, staging swap) | implements `ContentBackend` |
| `db.web.ts` | in-memory JSON backend (OD-1; also the jest backend) | implements `ContentBackend` |
| `contentStore.ts` | orchestrate ingest→validate→stage→swap→meta; quarantine; write-queue; rollback | `ingest/ingestBundleSet/rollback/datasetVersion/status` |
| `migrate.ts` | schema-version migration chain | `migrateToCurrent(...)` |
| `queries.ts` | typed read API for consumers | `lessonSections/range/node/quiz/grounding/packManifest/access` |
| `bundle.ts` | locate+read bundled packs via expo-file-system/asset | `loadBundledSet()` |
| `__tests__/` | validate/schemaGen/hash unit + store round-trip/quarantine (in-memory backend) + fixtures | — |

## `src/context/ContentContext.tsx` (owner: platform)
`useContent()` → `{ isLoaded, status, query, refresh }`. Lazy bootstrap (06 lifecycle); mounted **inside
`EntitlementsProvider`, above `StudyProvider`/`CoachProvider`** in `App.tsx`. Dev assertion if default value read.

## Learning (owner: study/frontend)
`features/study/ui/LessonReaderScreen.tsx` (Markdown via `react-native-markdown-display`, themed) ·
`ModulesScreen.tsx` · `QuizRunnerScreen.tsx` · `PostflopTreeScreen.tsx` · `logic/quizRunner.ts` (pure grading).
`StudyContext.tsx` refactor (ranges from ContentStore + fallback). Routes added to **both** nav trees.

## Coach (owner: coach/frontend+backend)
`features/coach/data/groundingStore.ts` (load JSON; cross-platform) · `logic/grounding.ts` (pure;
**SafeToAssert single seam**) · wire into `CoachContext`/`serverCoachProvider` (contract unchanged). Future
(out of Phase 0–5): server `ICoachAiProvider` + `KnowledgeStore`.

## Premium (owner: monetization/frontend)
`features/premium/logic/contentAccess.ts` (two-level gating ∘ `has()`, fail-closed) ·
`logic/marketableLabel.ts` (≥95% gate; `MarketableAs` verbatim) · `ui/PackCatalogScreen.tsx`.

## Analytics + Mastery (owner: data/platform)
`utils/analyticsContract.ts` (EV-01..11 mapping + RequiredFields) · `analytics/sink.ts` (idempotent fact writes
to user store) · `utils/analytics.ts` (`dispatch()` adapter) · `features/mastery/logic/mastery.ts` (pure
MM-01..05 projections) · `state/MasteryContext.tsx` · `data/masteryStore.ts` (user store).

## Config / build (owner: platform)
`config/features.ts` (+`content`,`mastery`) · `jest.config.js` (+`src/content`,`src/analytics` globs) ·
`package.json`+`app.json` (`expo-sqlite`, `react-native-markdown-display`) ·
`assets/content/<dataset_version>/*.pack.json` + `coach_grounding.json` (**vendored from the content team**) ·
CI validation step (run `validate.ts` over the vendored set).
