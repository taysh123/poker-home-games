import { combosForHand, weightedCombos, TOTAL_PREFLOP_COMBOS } from '../combos';
import { diffRanges, maxFreqDelta } from '../compare';
import { buildInspectorView } from '../inspector';
import type { PreflopRange } from '../../../study/types';

const baseRange: PreflopRange = {
  id: 'r1', format: 'cash', tableSize: 6, stackBb: 100, scenario: 'RFI', heroPosition: 'BTN', label: 'BTN RFI',
  strategy: {
    AA: [{ action: 'raise', freq: 1 }],
    T9s: [{ action: 'raise', freq: 0.6 }, { action: 'fold', freq: 0.4 }],
    '72o': [{ action: 'fold', freq: 1 }],
  },
};

describe('combos (pure combinatorics, not solver data)', () => {
  it('counts pair/suited/offsuit', () => {
    expect(combosForHand('AA')).toBe(6);
    expect(combosForHand('AKs')).toBe(4);
    expect(combosForHand('AKo')).toBe(12);
    expect(combosForHand('???')).toBe(0);
  });
  it('weights combos by frequency', () => {
    expect(weightedCombos([{ hand: 'AA', freq: 1 }, { hand: 'AKs', freq: 0.5 }])).toBe(8);
  });
  it('exposes the total combo space', () => {
    expect(TOTAL_PREFLOP_COMBOS).toBe(1326);
  });
});

describe('compare', () => {
  it('identical ranges diff to empty', () => {
    expect(diffRanges(baseRange, baseRange)).toEqual([]);
  });
  it('surfaces changed hands, sorted by magnitude', () => {
    const other: PreflopRange = { ...baseRange, label: 'tighter', strategy: { ...baseRange.strategy, T9s: [{ action: 'fold', freq: 1 }] } };
    const diff = diffRanges(baseRange, other);
    expect(diff).toHaveLength(1);
    expect(diff[0].hand).toBe('T9s');
    expect(diff[0].maxDelta).toBeCloseTo(0.6, 5);
  });
  it('maxFreqDelta handles missing actions', () => {
    expect(maxFreqDelta([{ action: 'raise', freq: 1 }], [])).toBe(1);
  });
});

describe('inspector view-model (honesty gate)', () => {
  it('shows real frequencies + derived combos + context; NO EV/equity when absent', () => {
    const v = buildInspectorView(baseRange, 'T9s');
    expect(v.actions).toEqual([
      { action: 'raise', freqPct: 60, sizeBb: undefined, evBb: undefined, equity: undefined },
      { action: 'fold', freqPct: 40, sizeBb: undefined, evBb: undefined, equity: undefined },
    ]);
    expect(v.comboCount).toBe(4);            // T9s suited
    expect(v.hasSolverData).toBe(false);     // illustrative range → no EV/equity
    expect(v.verificationTier).toBe('illustrative');
    expect(v.inRange).toBe(true);
    expect(v.context).toContain('BTN');
    expect(v.context).toContain('100bb');
  });
  it('marks a pure-fold hand as not in range', () => {
    expect(buildInspectorView(baseRange, '72o').inRange).toBe(false);
  });
  it('surfaces EV/equity ONLY when the data carries them', () => {
    const solved: PreflopRange = { ...baseRange, strategy: { AA: [{ action: 'raise', freq: 1, evBb: 3.2, equity: 0.85 }] } };
    const v = buildInspectorView(solved, 'AA', { tier: 'solver' });
    expect(v.hasSolverData).toBe(true);
    expect(v.actions[0].evBb).toBe(3.2);
    expect(v.actions[0].equity).toBe(0.85);
    expect(v.verificationTier).toBe('solver');
  });
  it('computes a compare delta when compareTo is given', () => {
    const other: PreflopRange = { ...baseRange, label: 'Other', strategy: { T9s: [{ action: 'fold', freq: 1 }] } };
    const v = buildInspectorView(baseRange, 'T9s', { compareTo: other });
    expect(v.diff?.otherLabel).toBe('Other');
    expect(v.diff?.maxDelta).toBeCloseTo(0.6, 5);
  });
});
