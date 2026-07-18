/**
 * Splash timeline invariants (product decision 2026-07-05): ~1.2s on every cold
 * start, always skippable, reduced-motion gets a short static frame. These pins
 * keep future tweaks inside the approved envelope.
 */
import { SPLASH, splashDurations } from '../splashTimeline';

describe('SPLASH timeline', () => {
  it('runs ~1.2s total and never past 1.3s (product budget: short splash)', () => {
    expect(SPLASH.TOTAL).toBe(SPLASH.EXIT_AT + SPLASH.EXIT);
    expect(SPLASH.TOTAL).toBe(1200);
    expect(SPLASH.TOTAL).toBeLessThanOrEqual(1300);
  });

  it('every entrance beat lands before the hold ends (nothing animates into the exit)', () => {
    expect(SPLASH.LOGO_IN).toBeLessThanOrEqual(SPLASH.EXIT_AT);
    expect(SPLASH.WORD_DELAY + SPLASH.WORD_IN).toBeLessThanOrEqual(SPLASH.EXIT_AT);
    expect(SPLASH.TAG_DELAY + SPLASH.TAG_IN).toBeLessThanOrEqual(SPLASH.EXIT_AT);
  });

  it('exit is faster than the enter block (exit-faster-than-enter motion rule)', () => {
    const enterBlock = SPLASH.TAG_DELAY + SPLASH.TAG_IN; // last entrance beat
    expect(SPLASH.EXIT).toBeLessThan(enterBlock);
    expect(SPLASH.EXIT).toBeLessThanOrEqual(300);
  });

  it('skip exit is snappier than the natural exit', () => {
    expect(SPLASH.SKIP_EXIT).toBeLessThan(SPLASH.EXIT);
  });

  it('reduced motion: short static frame, no choreography', () => {
    expect(SPLASH.REDUCED_HOLD).toBeLessThanOrEqual(800);
    expect(splashDurations(true)).toEqual({ total: SPLASH.REDUCED_HOLD, exit: 0 });
  });

  it('full motion: total includes the exit fade', () => {
    expect(splashDurations(false)).toEqual({ total: SPLASH.TOTAL, exit: SPLASH.EXIT });
  });
});
