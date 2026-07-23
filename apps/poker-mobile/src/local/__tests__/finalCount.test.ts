import { computeFinalCount, centsFinalCountModel, decimalFinalCountModel, type FinalCountModel } from '../finalCount';
import { formatCents } from '../../utils/money';
import { formatMoney } from '../../utils/formatters';

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

  it('does not add blank or invalid entries to the total', () => {
    const s = computeFinalCount({ a: '', b: '  ', c: 'abc', d: '-5' }, exact(1000));
    expect(s.totalEntered).toBe(0);
  });

  it('hasAnyEntered is trim-based: a non-empty-but-invalid field still counts as entered', () => {
    expect(computeFinalCount({ a: 'abc' }, exact(1000)).hasAnyEntered).toBe(true);
    expect(computeFinalCount({ a: '', b: '  ' }, exact(1000)).hasAnyEntered).toBe(false);
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

  it('rejects negative / zero / junk via parseAmountToCents (not added to the total)', () => {
    const s = computeFinalCount({ a: '-1', b: 'x', c: '0' }, centsFinalCountModel(5000));
    expect(s.totalEntered).toBe(0);
    expect(s.hasAnyEntered).toBe(true); // trim-based: non-empty, just invalid
  });

  it('formats through the shared formatCents helper', () => {
    expect(centsFinalCountModel(0).format(4000)).toBe(formatCents(4000));
  });
});

describe('decimalFinalCountModel (server decimal + chips, |diff| < 0.5) — behavior-preserving for SessionScreen', () => {
  it('balances within 0.5 of the expected remaining (money mode)', () => {
    const m = decimalFinalCountModel({ expectedRemainingUnits: 100, useChips: false });
    expect(computeFinalCount({ a: '50', b: '50.3' }, m).isBalanced).toBe(true);  // diff 0.3 < 0.5
    expect(computeFinalCount({ a: '50', b: '50.9' }, m).isBalanced).toBe(false); // diff 0.9
    expect(computeFinalCount({ a: '50', b: '40' }, m).short).toBe(true);         // diff -10
  });

  it('no entries is balanced (allowEmpty — matches the server !hasAnyEntered)', () => {
    const m = decimalFinalCountModel({ expectedRemainingUnits: 100, useChips: false });
    expect(computeFinalCount({}, m).isBalanced).toBe(true);
  });

  it('an all-invalid entry is NOT balanced (trim-based hasAnyEntered blocks it, exactly like the server)', () => {
    const m = decimalFinalCountModel({ expectedRemainingUnits: 100, useChips: false });
    const s = computeFinalCount({ a: 'abc' }, m);
    expect(s.hasAnyEntered).toBe(true);
    expect(s.totalEntered).toBe(0);
    expect(s.isBalanced).toBe(false); // hasAny=true ⇒ falls through to |−100| < 0.5 = false
  });

  it('chips mode: rounds + comma-formats and labels "chips"', () => {
    const m = decimalFinalCountModel({ expectedRemainingUnits: 12000, useChips: true });
    expect(m.format(1000.4)).toBe((1000).toLocaleString());
    expect(m.unitLabel).toBe('chips');
    expect(computeFinalCount({ a: '6000', b: '6000' }, m).isBalanced).toBe(true);
  });

  it('money mode: formats via formatMoney with no trailing unit label', () => {
    const m = decimalFinalCountModel({ expectedRemainingUnits: 100, useChips: false });
    expect(m.format(40)).toBe(formatMoney(40));
    expect(m.unitLabel).toBe('');
  });
});
