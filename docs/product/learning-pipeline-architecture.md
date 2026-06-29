# Solver → Coach → Quiz → Mastery Learning Pipeline (Deliverable N)

> **Design-only; additive, flag-gated.** Connects the existing pillars into one learning loop, reusing
> `features/solver`, `features/coach`, `features/study`, and the `mastery` engine — no new foundations.

## End-to-end flow
```
SOLVER (canonical pack: ranges/spots/nodes, tiers)
   │  a spot/range = the unit of study
   ▼
COACH  (features/coach → POST /api/coach/analyze, Anthropic-or-mock, server-key)
   │  grounds explanations on the spot (range context + tier); honest demo when mock
   ▼
QUIZ   (features/study QuizDoc / SpotTrainer)
   │  generate quiz items FROM solver spots (hand + scenario → question; correct = max-frequency action)
   ▼
MASTERY (mastery engine: attempts → ObjectiveStat → aggregate)
      rolls quiz/trainer outcomes into per-objective mastery + progression
```

## Data flow + contracts (reuse existing)
- **Solver→Coach:** a spot (`packId/rangeId/hand/nodeId` + context) becomes `CoachAnalysisInput`. The coach
  output already carries an educational disclaimer + provider/tier.
- **Solver→Quiz:** a pure generator maps a `SolverRange` + hand → a `range_spot` quiz item (grading reuses
  `study/logic/trainer.evaluateSpot`). Solver tier flows onto the item (illustrative vs solver-verified).
- **Quiz→Mastery:** trainer/quiz results feed the existing `attemptStore` → `aggregate` → `MasteryContext`
  (objectives keyed by scenario/position/spot).
- **Progression:** mastery per objective → recommended next spots (weakest objectives) → back into the solver
  workspace / trainer (the loop).

## Progression model
Per-objective mastery (attempts, correct, recency) → levels (e.g. new → learning → strong) → a recommendation
queue. Reuses the retention/streak engine for habit; additive fields only.

## Gating + honesty
Each hop is flag-gated (`solver`/`coach`/`study`/`mastery`, all OFF in prod). No fabricated AI/solver values —
mock/illustrative are labelled end-to-end. This doc is the architecture; implementation is a future phase.
