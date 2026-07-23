import { computeFinalCount, centsFinalCountModel, type FinalCountModel } from '../finalCount';
import { formatCents } from '../../utils/money';

/** Minimal exact-integer model for exercising the core directly (mirrors the cents model's rules). */
const exact = (expectedRemaining: number, over: Partial<FinalCountModel> = {}): FinalCountModel => ({
  parse: (s) => { const n = Number(s); return Number.isInteger(n) && n >= 0 ? n : null; },
  format: (n) => String(n),
  expectedRemaining,
  allowEmpty: false,
  isWithinTolerance: (diff) => diff === 0,
  unitLabel: '',
  ...over,
});

describe('computeFinalCount', () => {
  it('balances when entries sum exactly to the expected remaining', () => {
    const s = computeFinalCount({ a: '600', b: '400' }, exact(1000));
    expect(s.totalEntered).toBe(1000);
    expect(s.diff).toBe(0);
    expect(s.isBalanced).toBe(true);
    expect(s.over).toBe(false);
    expect(s.short).toBe(false);
  });

  it('is short when entries undercount', () => {
    const s = computeFinalCount({ a: '600', b: '300' }, exact(1000));
    expect(s.diff).toBe(-100);
    expect(s.isBalanced).toBe(false);
    expect(s.short).toBe(true);
    expect(s.over).toBe(false);
  });

  it('is over when entries overcount', () => {
    const s = computeFinalCount({ a: '600', b: '600' }, exact(1000));
    expect(s.diff).toBe(200);
    expect(s.over).toBe(true);
    expect(s.short).toBe(false);
    expect(s.isBalanced).toBe(false);
  });

  it('skips blank and invalid entries (they do not count toward the total or hasAnyEntered)', () => {
    const s = computeFinalCount({ a: '', b: '  ', c: 'abc', d: '-5' }, exact(1000));
    expect(s.totalEntered).toBe(0);
    expect(s.hasAnyEntered).toBe(false);
  });

  it('with allowEmpty=false, no entries is NOT balanced (local semantics)', () => {
    const s = computeFinalCount({}, exact(1000));
    expect(s.hasAnyEntered).toBe(false);
    expect(s.isBalanced).toBe(false);
  });

  it('with allowEmpty=true, no entries IS balanced (server semantics)', () => {
    const s = computeFinalCount({}, exact(1000, { allowEmpty: true }));
    expect(s.hasAnyEntered).toBe(false);
    expect(s.isBalanced).toBe(true);
  });

  it('respects a non-zero tolerance without changing the raw diff', () => {
    const model = exact(1000, {
      parse: (x) => { const n = Number(x); return Number.isFinite(n) && n >= 0 ? n : null; },
      isWithinTolerance: (d) => Math.abs(d) < 0.5,
    });
    const s = computeFinalCount({ a: '1000.4' }, model);
    expect(s.diff).toBeCloseTo(0.4);
    expect(s.isBalanced).toBe(true); // within 0.5
    expect(s.over).toBe(false);
  });
});

describe('centsFinalCountModel (local integer-cents, exact) — behavior-preserving for LocalSessionScreen', () => {
  it('balances only on an exact cents match; 1 agora over is unbalanced', () => {
    const m = centsFinalCountModel(10000); // ₪100.00 remaining
    expect(computeFinalCount({ a: '60', b: '40' }, m).isBalanced).toBe(true);    // 6000 + 4000
    expect(computeFinalCount({ a: '60', b: '40.01' }, m).isBalanced).toBe(false); // 1 agora over
    expect(computeFinalCount({ a: '60' }, m).short).toBe(true);
  });

  it('no entries is NOT balanced (must count or override — local semantics)', () => {
    expect(computeFinalCount({}, centsFinalCountModel(10000)).isBalanced).toBe(false);
  });

  it('rejects negative / zero / junk via parseAmountToCents (ignored, not counted)', () => {
    const s = computeFinalCount({ a: '-1', b: 'x', c: '0' }, centsFinalCountModel(5000));
    expect(s.hasAnyEntered).toBe(false);
    expect(s.totalEntered).toBe(0);
  });

  it('formats through the shared formatCents helper', () => {
    expect(centsFinalCountModel(0).format(4000)).toBe(formatCents(4000));
  });
});
