/**
 * quizGrounding — pure bridge between a quiz question and the honesty-gated
 * calibrated assertions for its linked concept.
 *
 * The honesty seam is in useCoachGrounding / assertionsForConcept — this helper
 * ONLY calls that accessor; it never touches raw claim_text or bypasses
 * safe_to_assert. Keep it that way.
 */

/**
 * Calibrated references for a quiz question: the caveat-bearing assertions for
 * its linked concept (via the honesty-gated accessor), capped. Empty when the
 * question has no concept link or grounding is unavailable.
 *
 * @param question           - Any object with an optional `lessonId` (maps to a concept id like "CK-002").
 * @param assertionsForConcept - The safe-to-assert accessor from useCoachGrounding().
 * @param max                - Maximum assertions to surface (default 2; 0 → always empty).
 */
export function groundingForQuestion(
  question: { lessonId?: string },
  assertionsForConcept: (conceptId: string) => string[],
  max = 2,
): string[] {
  if (!question.lessonId) return [];
  return assertionsForConcept(question.lessonId).slice(0, Math.max(0, max));
}
