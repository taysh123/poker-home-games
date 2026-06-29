/**
 * Coach feature (Improve pillar) — V2 Phase 3.
 *
 * AI hand-analysis coach: three inputs (screenshot upload, hand-history paste,
 * manual spot) behind a provider-agnostic ICoachService; v1 output is analysis,
 * mistakes, tips, and alternative lines (no EV/solver claims). Scaffolding first.
 * See ../README.md for the module layout.
 *
 * Grounding (V2.2, content-flag-gated): the coach can consult workbook-derived, safe-to-assert
 * claims via `useCoachGrounding()` — pure gate in logic/grounding.ts, bundled artifact loaded by
 * data/groundingStore.ts. Inert (returns null) when the `content` flag is OFF.
 */
export { useCoachGrounding } from './data/useCoachGrounding';
export type { CoachGrounding } from './data/useCoachGrounding';
export {
  assertion,
  isAssertable,
  claimsForConcept,
  assertableClaimsForConcept,
  claimById,
  allAssertableClaims,
  buildGroundingIndex,
} from './logic/grounding';
export type { GroundedClaim, GroundingDataset, GroundingIndex } from './logic/grounding';
