import { optionsForScenario, bestAction, evaluateSpot, generateSpot } from '../trainer';
import type { PreflopRange, RangeDataset } from '../../types';
import { buildStrategy } from '../handGrid';

const rfi: PreflopRange = {
  id: 'r', format: 'cash', tableSize: 6, stackBb: 100, scenario: 'RFI',
  heroPosition: 'BTN', label: 'BTN', openSizeBb: 2.5,
  strategy: buildStrategy({ raise: 'QQ+' }),
};

describe('options + bestAction', () => {
  it('offers fold/raise for RFI and fold/call/raise when facing', () => {
    expect(optionsForScenario('RFI')).toEqual(['fold', 'raise']);
    expect(optionsForScenario('vs_RFI')).toEqual(['fold', 'call', 'raise']);
  });
  it('bestAction picks max frequency, tie-break raise > call > fold', () => {
    expect(bestAction([{ action: 'fold', freq: 0.5 }, { action: 'raise', freq: 0.5 }])).toBe('raise');
    expect(bestAction([{ action: 'call', freq: 0.7 }, { action: 'raise', freq: 0.3 }])).toBe('call');
  });
});

describe('evaluateSpot', () => {
  it('grades a pure raise hand correctly', () => {
    expect(evaluateSpot(rfi, 'AA', 'raise').correct).toBe(true);
    expect(evaluateSpot(rfi, 'AA', 'fold').correct).toBe(false);
  });
  it('grades a fold hand correctly', () => {
    expect(evaluateSpot(rfi, '72o', 'fold').correct).toBe(true);
    expect(evaluateSpot(rfi, '72o', 'raise').correct).toBe(false);
  });
  it('accepts either action of a 50/50 mix', () => {
    const mixed: PreflopRange = { ...rfi, strategy: { ...rfi.strategy, KK: [{ action: 'raise', freq: 0.5 }, { action: 'call', freq: 0.5 }] } };
    expect(evaluateSpot(mixed, 'KK', 'raise').correct).toBe(true);
    expect(evaluateSpot(mixed, 'KK', 'call').correct).toBe(true);
    expect(evaluateSpot(mixed, 'KK', 'fold').correct).toBe(false);
  });
});

describe('generateSpot', () => {
  it('is deterministic with an injected rng', () => {
    const ds: RangeDataset = { schemaVersion: 1, name: 'x', isIllustrative: true, ranges: [rfi] };
    const spot = generateSpot(ds, () => 0);
    expect(spot.range.id).toBe('r');
    expect(typeof spot.hand).toBe('string');
    expect(spot.options).toEqual(['fold', 'raise']);
  });
});
