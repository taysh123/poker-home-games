import { deriveIsCelebrating } from '../celebration';

/**
 * Full truth table. Each of the three terms is exercised independently, so dropping ANY of them
 * fails here — which the previous provider-level test could not do (a mutation run dropped
 * `enabled` and dropped `celebrate` and it stayed green on both).
 */
describe('deriveIsCelebrating', () => {
  it('is false at rest', () => {
    expect(deriveIsCelebrating({ enabled: true, unlockQueueLength: 0, celebrate: false })).toBe(false);
  });

  it('is true while an achievement unlock is queued', () => {
    expect(deriveIsCelebrating({ enabled: true, unlockQueueLength: 1, celebrate: false })).toBe(true);
  });

  it('is true during a rank-up burst', () => {
    // PINS THE `celebrate` TERM. Dropping it lets the review request fire over the rank-up
    // Celebration — the exact collision the signal exists to prevent.
    expect(deriveIsCelebrating({ enabled: true, unlockQueueLength: 0, celebrate: true })).toBe(true);
  });

  it('is true when both are active', () => {
    expect(deriveIsCelebrating({ enabled: true, unlockQueueLength: 2, celebrate: true })).toBe(true);
  });

  it('is FALSE when retention is off, even with a queued unlock', () => {
    // PINS THE `enabled` TERM. Both celebration renders are gated on it, so with retention off
    // nothing can appear; reporting "celebrating" would suppress the review request forever for
    // that cohort.
    expect(deriveIsCelebrating({ enabled: false, unlockQueueLength: 3, celebrate: false })).toBe(false);
  });

  it('is FALSE when retention is off, even during a rank-up burst', () => {
    expect(deriveIsCelebrating({ enabled: false, unlockQueueLength: 0, celebrate: true })).toBe(false);
  });
});
