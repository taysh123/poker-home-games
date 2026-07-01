/**
 * quizGrounding tests — pure helper that bridges a quiz question's lessonId to
 * caveat-bearing calibrated assertions via the honesty-gated accessor.
 */
import { groundingForQuestion } from '../quizGrounding';

const THREE_ASSERTIONS = [
  'UTG opens ~13.4% (RFI) at 100bb 6-max (Calibrated — chip-EV model, 6-max). Not solver-exact.',
  'Fold equity matters more at 40bb than 100bb. Model-dependent (ICM/payouts).',
  'Extra third assertion that should be cut by the cap.',
];

describe('groundingForQuestion', () => {
  it('returns the first 2 assertions for a linked question (default cap of 2)', () => {
    const assertionsForConcept = jest.fn().mockReturnValue(THREE_ASSERTIONS);
    const result = groundingForQuestion({ lessonId: 'CK-002' }, assertionsForConcept);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(THREE_ASSERTIONS[0]);
    expect(result[1]).toBe(THREE_ASSERTIONS[1]);
    expect(assertionsForConcept).toHaveBeenCalledWith('CK-002');
  });

  it('returns empty array and never calls assertionsForConcept when lessonId is absent', () => {
    const assertionsForConcept = jest.fn();
    expect(groundingForQuestion({}, assertionsForConcept)).toEqual([]);
    expect(groundingForQuestion({ lessonId: undefined }, assertionsForConcept)).toEqual([]);
    expect(assertionsForConcept).not.toHaveBeenCalled();
  });

  it('respects the max cap: max=0 returns empty, max=1 returns one', () => {
    const assertionsForConcept = jest.fn().mockReturnValue(THREE_ASSERTIONS);
    expect(groundingForQuestion({ lessonId: 'CK-001' }, assertionsForConcept, 0)).toEqual([]);
    expect(groundingForQuestion({ lessonId: 'CK-001' }, assertionsForConcept, 1)).toHaveLength(1);
    expect(groundingForQuestion({ lessonId: 'CK-001' }, assertionsForConcept, 1)[0]).toBe(THREE_ASSERTIONS[0]);
  });
});
