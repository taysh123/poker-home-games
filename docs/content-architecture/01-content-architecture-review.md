# 01 — Content Architecture Review

**Deliverable 1.** A synthesis of the current Study, Spot Trainer, Decision Trainer, Quiz, Coach, and
dataset-loading systems, the seams they already expose, the gaps, and the target end-state for receiving a
large commercial content base.

---

## 1. Current systems (as audited)

### 1.1 Study dataset + loading
- **Type seam already exists.** `src/features/study/types.ts` defines `RangeDataset` — explicitly commented as
  *"the IMPORT format for future solver data"* — `{ schemaVersion: 1, name, isIllustrative, ranges:
  PreflopRange[] }`. `PreflopRange` carries `format ('cash'|'mtt')`, `tableSize`, `stackBb`, `scenario
  ('RFI'|'vs_RFI')`, `heroPosition`, `villainPosition?`, `openSizeBb?`, `label`, `strategy: HandStrategy`.
  `HandStrategy = Record<HandKey, ActionFrequency[]>` already supports **mixed frequencies**.
- **Loading is static.** `src/features/study/state/StudyContext.tsx` imports `STARTER_DATASET` at module load
  and exposes it read-only via `useStudy().dataset`. There is **no async/import path yet** — this is the single
  seam a future content source plugs into.
- **Authoring → runtime expansion.** `src/features/study/data/starterRanges.ts` authors ranges with compact
  notation (`'77+, AJs+'`); `src/features/study/logic/handGrid.ts buildStrategy()` expands notation → a full
  169-hand `HandStrategy`. Commercial/solver data can **bypass** expansion by supplying `HandStrategy` directly.
- **Persistence pattern.** `src/features/study/data/studyStore.ts` persists *progress* (not the dataset) with
  versioned load → `migrateToCurrent` → quarantine on corrupt JSON (`tpoker.study.v1`). This is the pattern a
  content cache should mirror.

### 1.2 Spot Trainer / Decision Trainer / Quiz
- One screen, two modes: `src/features/study/ui/SpotTrainerScreen.tsx` (`mode: 'spot'` = a fixed **10-spot
  quiz** with scoring; `mode: 'decision'` = continuous drilling).
- Spots are **generated**, not authored: `logic/trainer.ts generateSpot(dataset, rng)` picks a random range +
  random hand; `evaluateSpot()` grades against the strategy (mixed-freq aware); `optionsForScenario()` derives
  the buttons. `QUIZ_LENGTH = 10` is hardcoded.
- **Implication:** today a "quiz" is an ephemeral, RNG-driven sampling of ranges — there is **no authored quiz
  content type**. A commercial workbook will want curated quizzes and ordered learning, which today has no home.

### 1.3 Coach
- Clean provider abstraction. Client `ICoachProvider.analyze(req) → CoachAnalysis`
  (`src/features/coach/types.ts`); server `ICoachAiProvider.AnalyzeAsync` (C#,
  `PokerApp.Application/Common/Interfaces/ICoachAiProvider.cs`).
- **No knowledge retrieval today** — both the client `mockCoachProvider` and server `MockCoachAiProvider`
  return templated text. A server-authoritative path (credit ledger, fraud check, audit) already exists.
- **Implication:** the coach has a ready-made injection point but no knowledge to ground on. Commercial
  knowledge (ranges + concept explanations) is exactly what would make it "real."

### 1.4 Entitlements / gating
- `resolveEntitlement` (fail-closed) → `EntitlementsContext.has(entitlement)`; `PremiumFeatureKey` already
  includes `advanced_gto` and `premium_learning`; `PremiumGate` wraps gated UI; `GET /api/entitlements` is the
  server authority. Per-content gating is a thin composition over `has()`.

---

## 2. Strengths (build on these)

1. The **import format already exists and is named** (`RangeDataset`) — the trainer/quiz read it generically.
2. **Mixed-frequency strategies** are already modeled and graded — commercial solver output fits natively.
3. The **coach provider seam** absorbs a knowledge base with zero client change.
4. A battle-tested **versioned-store + quarantine + write-queue** pattern exists to copy for a content cache.
5. **Entitlement keys for content already exist** (`advanced_gto`, `premium_learning`).

## 3. Gaps (what this architecture closes)

| Gap | Impact | Closed by |
|-----|--------|-----------|
| No async content source (static import only) | Can't load server/commercial content | 02, 06 (`loadDataset()` seam) |
| Only one content type (ranges) | No lessons/quizzes/paths/knowledge | 03 (broad `ContentPack`) |
| Quizzes are RNG-sampled, not authored | No curated/commercial quizzes | 03 (`QuizDoc`), 01 §6 |
| No learning sequence | No guided progression | 03 (`LearningPathDoc`), 01 §7 |
| Coach has no knowledge to retrieve | "Demo only" forever | 05 |
| No content delivery/cache/gating | Can't ship or protect commercial packs | 02, 04 |
| Hardcoded 6-max/100bb/cash/preflop | Commercial breadth blocked | 06 (additive v2) |

## 4. Hardcoded assumptions to lift (additively)

- `cash100()` helper hardcodes `tableSize: 6`, `stackBb: 100`, `format: 'cash'`, `openSizeBb: 2.5`.
- `RangeScenario` is `'RFI' | 'vs_RFI'` (preflop, ≤2 players). Marked in-code as extensible.
- `QUIZ_LENGTH = 10` hardcoded in the trainer.

All are **data/union extensions**, not rewrites — see [06](06-migration-plan.md).

## 5. Target end-state (overview)

```
                       ┌─────────────────────── BUILD TIME ───────────────────────┐
 commercial workbook → │  authoring CLI  →  validate (JSON Schema)  →  sign+stamp   │ → published ContentPacks
                       └───────────────────────────────────────────────────────────┘
                                                  │ (server)
                  GET /api/content/index (gated)  │  GET /api/content/{id} (signed)
                                                  ▼
 ┌──────────────────────────────── DEVICE (client) ───────────────────────────────┐
 │  ContentRepository                                                              │
 │   • bundled STARTER_DATASET  (free, offline fallback)                          │
 │   • cached packs  tpoker.content.v1  (versioned + migrate + quarantine)        │
 │   • useContentAccess(packId) = EntitlementsContext.has(entitlements[])         │
 │                                                                                │
 │   ranges ─► Study trainer/quiz (unchanged consumers, now data-driven)          │
 │   quizzes ─► authored quiz runner (new consumer; RNG sampling = fallback)      │
 │   paths   ─► learning-path runner (new)                                        │
 │   lessons ─► lesson reader (new)                                               │
 └────────────────────────────────────────────────────────────────────────────────┘
                                                  ▲
                                                  │ (server-resident knowledge; never on device)
 ┌──────────────────────────────── COACH (server) ────────────────────────────────┐
 │  ICoachAiProvider ← KnowledgeStore (ranges + CoachKnowledgeDoc) → grounded reply │
 └────────────────────────────────────────────────────────────────────────────────┘
```

## 6. Quiz content architecture (intent; schema in [03](03-json-schema-specification.md))

- A `QuizDoc` is an **authored, ordered** set of questions. A question references a spot (range id + hand, or a
  self-contained prompt) and declares the correct action(s) + an explanation.
- The current RNG sampler (`generateSpot`) remains as a **generated-quiz fallback** when no authored quiz
  exists for a topic — so the trainer never has an empty state.
- `QUIZ_LENGTH` becomes a property of the `QuizDoc` (authored length) with the 10-spot default retained for
  generated quizzes.
- Grading reuses `evaluateSpot` semantics (mixed-frequency correctness), extended to accept an authored
  `correctActions` set for non-range questions.

## 7. Learning-path architecture (intent; schema in [03](03-json-schema-specification.md))

- A `LearningPathDoc` is an **ordered list of steps**; each step references a lesson, quiz, or range-drill by
  id, with optional unlock rules (e.g., "≥80% on the prior quiz").
- Progress is tracked in the existing study progress store (extended additively, schema-versioned), reusing the
  streak/daily-goal engine in `logic/progress.ts`.
- Paths are gated like any content (a path can require `premium_learning`); the free starter path uses bundled
  ranges so a guest always has a first rung.

## 8. Cross-references
- Pipeline + update strategy → [02](02-import-pipeline-design.md), [04](04-content-pack-specification.md)
- Concrete shapes → [03](03-json-schema-specification.md)
- Coach grounding → [05](05-coach-knowledge-integration.md)
- Rollout → [06](06-migration-plan.md)
