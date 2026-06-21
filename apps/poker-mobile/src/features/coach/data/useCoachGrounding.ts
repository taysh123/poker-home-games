/**
 * useCoachGrounding — minimal, read-only accessor the coach layer can query for grounded,
 * safe-to-assert claims. Returns `null` when the content flag is OFF (no UI/provider change).
 *
 * Surface hardening (defense in depth): the consumer-facing claim shape OMITS
 * `assertion_template`, and the raw index is NOT exposed — so the ONLY way to obtain a
 * sentence the coach may state as fact is `assertionsForConcept`, which routes through the
 * honesty seam (`assertion()` in logic/grounding.ts). A caller cannot read a template and
 * bypass the `safe_to_assert` gate.
 */
import { useMemo } from 'react';
import { loadGroundingIndex } from './groundingStore';
import {
  assertion,
  assertableClaimsForConcept,
  claimsForConcept,
  type GroundedClaim,
} from '../logic/grounding';

/** Inspection-only view of a grounded claim — never carries the assertable template. */
export type GroundedClaimView = Omit<GroundedClaim, 'assertion_template'>;

const toView = ({ assertion_template, ...rest }: GroundedClaim): GroundedClaimView => rest;

export interface CoachGrounding {
  /** Dataset version of the bundled artifact (e.g. "0.8.0"). */
  datasetVersion: string;
  /** All safe-to-assert sentences for a concept (verbatim, caveat-bearing). The only fact path. */
  assertionsForConcept: (conceptId: string) => string[];
  /** Safe-to-assert claims for a concept (inspection view — no template). */
  assertableClaims: (conceptId: string) => GroundedClaimView[];
  /** All claims for a concept, assertable or not (inspection view — no template). */
  claims: (conceptId: string) => GroundedClaimView[];
}

export function useCoachGrounding(): CoachGrounding | null {
  return useMemo(() => {
    const index = loadGroundingIndex();
    if (!index) return null;
    return {
      datasetVersion: index.datasetVersion,
      assertionsForConcept: (conceptId: string) =>
        assertableClaimsForConcept(index, conceptId)
          .map(assertion)
          .filter((s): s is string => s !== null),
      assertableClaims: (conceptId: string) => assertableClaimsForConcept(index, conceptId).map(toView),
      claims: (conceptId: string) => claimsForConcept(index, conceptId).map(toView),
    };
  }, []);
}
