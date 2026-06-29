import { PROD_FLAGS } from '../features';

/**
 * Honesty + launch-state CI guard (spec §6, §10). Phase 1 turns the free training taste ON in
 * production; the paid/unsafe flags stay OFF. A stray flip here changes what real users see, so we
 * pin the exact production flag matrix.
 */
describe('PROD_FLAGS — Phase 1 launch state', () => {
  it('turns the free training taste ON', () => {
    expect(PROD_FLAGS.study).toBe(true);
    expect(PROD_FLAGS.content).toBe(true);
    expect(PROD_FLAGS.retention).toBe(true);
  });

  it('turns the immersive felt surfaces ON (launch decision — live cash table + both summaries)', () => {
    expect(PROD_FLAGS.immersive).toBe(true);
  });

  it('keeps paid/unsafe surfaces OFF (paywall is Subsystem 3)', () => {
    expect(PROD_FLAGS.paywall).toBe(false);
    expect(PROD_FLAGS.coach).toBe(false);
    expect(PROD_FLAGS.solver).toBe(false);
    expect(PROD_FLAGS.mastery).toBe(false);
  });
});
