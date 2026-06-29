# Solver Session Replay (design-only)

> **Design-only; additive, flag-gated, no fabricated data.** Builds on the canonical `SolverNode` tree, the
> mastery attempt records, and the existing client-first store pattern — no new foundations, no adapter, no
> assumed solver/AI values. EV/equity are replayed ONLY when the underlying pack carries them (never invented).
> Nothing surfaces while `solver`/`mastery` are OFF in prod ⇒ production byte-identical.

## What it is
Step-by-step review of a finished study/solver session: walk a learner back through each decision they made and
show, decision-by-decision, **what they chose vs what the range says**. It is a read/inspect surface, not a new
solver — every fact comes from data already in the canonical pack and the mastery attempt log. The replay is the
"review" half of the loop in `learning-pipeline-architecture.md` (Quiz→Mastery already records the outcomes;
replay reads them back honestly).

## Built on the existing model
- **`SolverNode` tree** (`features/solver/pack/types.ts`): each replay step pins to a `nodeId` (or a `rangeId` +
  `hand` for preflop). `SolverNode.path[]` is the breadcrumb already used by the inspector; replay reuses it
  verbatim so the spot context is identical to the live workspace.
- **Mastery attempts** (`features/mastery/data/attemptStore.ts` → `ObjectiveStat`): an attempt already captures
  the per-objective `attempts`/`correct`/`lastActivityTs`. Replay needs the *per-decision* record (which hand,
  which action chosen, was it the max-frequency action) — see the additive log below; it does not change
  `ObjectiveStat`.
- **Inspector view-model** (`features/solver/logic/inspector.ts`): each step renders through `buildInspectorView`
  unchanged — `InspectorView.hasSolverData` already gates EV/equity, `verificationTier` is always labelled. The
  "chosen vs range" delta reuses the existing `compare` seam (`maxFreqDelta`), the same math compare-mode uses.

## Replay log data model (additive, client-first)
A new on-device store (`features/solver/data/replayStore.ts`, mirroring `savedSpotsStore.ts` /
`solverPackStore.ts`): same `tpoker.*.v1` key + **quarantine-never-lose** on a corrupt payload, never silently
cleared.

```
ReplaySession {
  id: string; createdAt: string (ISO);
  packId?: string; sourceLabel: string;   // honest provenance
  verificationTier: VerificationTier;      // copied from the pack — never upgraded
  steps: ReplayStep[];
}
ReplayStep {
  rangeId: string; nodeId?: string; hand: HandKey;   // pins into the canonical tree
  chosenAction: string;                              // what the user did
  recommendedAction: string;                         // = max-frequency action in the range
  correct: boolean;                                  // chosenAction === recommendedAction
  freqDelta?: number;                                // from compare.maxFreqDelta, when computable
}
```
All fields are additive; cash/study data is untouched. No EV/equity is stored on the step — it is read live from
the pack at render time so it can never drift from (or be fabricated ahead of) the source.

## Honesty rules
- A step shows EV/equity ONLY if `buildInspectorView(...).hasSolverData` is true for that range. Illustrative
  packs replay frequencies + the "illustrative" label, never numbers the pack didn't carry.
- `verificationTier` is copied from the pack onto the `ReplaySession` and never loosened (same rule as
  `grounding.ts` — a tier is copied verbatim, never upgraded).
- "Recommended" = the max-frequency action already defined by the trainer grading (`study/logic/trainer`), so
  replay and grading agree by construction.

## Reuse / wiring (all flag-gated + additive)
1. **Capture (first build step):** the trainer/quiz writes a `ReplayStep` per graded decision into `replayStore`
   when `solver`/`mastery` are ON. No change to `ObjectiveStat` aggregation.
2. **Replay UI:** a thin consumer of `buildInspectorView` + a step cursor (prev/next), reusing `SolverNode.path`
   for the breadcrumb and the compare delta for chosen-vs-range. Web SplitPane / mobile DetailSheet, same as the
   workspace.
3. **Loop back:** weak steps (wrong + high `freqDelta`) feed the mastery recommendation queue described in
   `learning-pipeline-architecture.md`.

## Out of scope here
- The live AI explanation of a replayed step — that is grounded coaching, designed in `ai-coach-2.0.md` (replay
  supplies the spot; the coach explains it through the grounding seam, never fabricating).
- Server-side replay history / sharing — client-first only; a server catalog is a separate, gated design (see
  `solver-storage.md`).

## Cross-links
`learning-pipeline-architecture.md` · `ai-coach-2.0.md` · `solver-pack-architecture.md` ·
`hover-inspector-and-compare.md` · `solver-flip-readiness-checklist.md`.
