/**
 * Pure-logic tests for the S1 design-system controls. Follows the repo convention
 * (see designSystem.test.ts) of testing the exported pure helpers rather than
 * rendering the RN components — keeps the suite fast and hermetic.
 */
import { clampProgress } from '../ProgressBar';
import { clampIndex, segmentThumbOffset } from '../Segmented';
import { staggerIn, slideUpSequence, successPop } from '../motion/recipes';
import { durations } from '../../theme/motion';

describe('ProgressBar — clampProgress (0..1)', () => {
  it('passes through in-range values', () => {
    expect(clampProgress(0)).toBe(0);
    expect(clampProgress(0.5)).toBe(0.5);
    expect(clampProgress(1)).toBe(1);
  });
  it('clamps below 0 and above 1', () => {
    expect(clampProgress(-0.2)).toBe(0);
    expect(clampProgress(-100)).toBe(0);
    expect(clampProgress(1.0001)).toBe(1);
    expect(clampProgress(42)).toBe(1);
  });
  it('treats NaN / non-finite / missing as 0 (safe default)', () => {
    expect(clampProgress(NaN)).toBe(0);
    expect(clampProgress(Infinity)).toBe(0); // non-finite is guarded to 0
    expect(clampProgress(-Infinity)).toBe(0);
    expect(clampProgress(undefined as unknown as number)).toBe(0);
  });
});

describe('Segmented — index selection behavior', () => {
  it('clampIndex keeps an in-range index', () => {
    expect(clampIndex(0, 3)).toBe(0);
    expect(clampIndex(1, 3)).toBe(1);
    expect(clampIndex(2, 3)).toBe(2);
  });
  it('clampIndex clamps out-of-range to the nearest valid segment', () => {
    expect(clampIndex(5, 3)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
  });
  it('clampIndex floors fractional indices and handles empty/NaN', () => {
    expect(clampIndex(1.9, 3)).toBe(1);
    expect(clampIndex(NaN, 3)).toBe(0);
    expect(clampIndex(0, 0)).toBe(0);
  });
  it('segmentThumbOffset = clampedIndex * segmentWidth', () => {
    expect(segmentThumbOffset(0, 100, 3)).toBe(0);
    expect(segmentThumbOffset(2, 100, 3)).toBe(200);
    expect(segmentThumbOffset(5, 100, 3)).toBe(200); // clamped to last segment
    expect(segmentThumbOffset(1, -50, 3)).toBe(0); // negative width guarded to 0
  });
});

describe('motion/recipes — reduced-motion aware', () => {
  it('staggerIn returns a per-item delay (40ms default, base offset, guards)', () => {
    expect(staggerIn(0)).toBe(0);
    expect(staggerIn(1)).toBe(40);
    expect(staggerIn(2, 50)).toBe(100);
    expect(staggerIn(3, 40, 100)).toBe(220);
    expect(staggerIn(-1)).toBe(0);
  });

  it('slideUpSequence animates by default and is instant under reduced motion', () => {
    const normal = slideUpSequence();
    expect(normal.from.opacity).toBe(0);
    expect(normal.from.translateY).toBe(12);
    expect(normal.animate.translateY).toBe(0);
    expect((normal.transition as { duration?: number }).duration).toBe(durations.normal);

    const reduced = slideUpSequence({ reduced: true });
    expect(reduced.from.opacity).toBe(1);
    expect(reduced.from.translateY).toBe(0);
    expect((reduced.transition as { duration?: number }).duration).toBe(0);
  });

  it('successPop springs by default and is instant under reduced motion', () => {
    const normal = successPop();
    expect(normal.from.scale).toBe(0.8);
    expect(normal.transition.type).toBe('spring');

    const reduced = successPop({ reduced: true });
    expect(reduced.from.scale).toBe(1);
    expect(reduced.transition.type).toBe('timing');
    expect((reduced.transition as { duration?: number }).duration).toBe(0);
  });
});
