/**
 * Q1.1 — converter from the content-repo's per-hand range rows (range_viewer_database shape)
 * to the app's RangeDataset. FAIL-CLOSED: anything the converter doesn't fully understand
 * (unknown scenario, unknown action, missing hands, mixed tiers) throws — a bad content drop
 * must fail the build/tests, never ship a wrong range.
 */
import { convertCalibratedRows, tierLabel, type CalibratedRangeRow } from '../rangeConvert';
import { allHands } from '../handGrid';
import type { RangeDataset } from '../../types';

/** Fabricate a complete 169-hand scenario: every hand folds unless overridden. */
function scenarioRows(
  scenario: string,
  overrides: Record<string, { action: string; freq: number }> = {},
  tier = 'Calibrated',
): CalibratedRangeRow[] {
  return allHands().map(hand => ({
    Scenario: scenario,
    Hand: hand,
    Action: overrides[hand]?.action ?? 'Fold',
    Frequency: overrides[hand]?.freq ?? 100,
    VerificationTier: tier,
  }));
}

describe('convertCalibratedRows', () => {
  it('converts an RFI scenario: metadata parsed, actions mapped, mixed splits get a fold remainder', () => {
    const rows = scenarioRows('RFI UTG 100bb 6-max', {
      AA: { action: 'Raise', freq: 100 },
      A9s: { action: 'Raise (mixed)', freq: 70 },
      '72o': { action: 'Fold', freq: 0 }, // source encodes folds with freq 0 OR 100 — both fold pure
    });
    const ds = convertCalibratedRows(rows, { name: 'Test' });
    expect(ds.verificationTier).toBe('calibrated');
    expect(ds.isIllustrative).toBe(false);
    expect(ds.ranges).toHaveLength(1);
    const r = ds.ranges[0];
    expect(r).toMatchObject({ scenario: 'RFI', heroPosition: 'UTG', stackBb: 100, tableSize: 6 });
    expect(r.strategy['AA']).toEqual([{ action: 'raise', freq: 1 }]);
    expect(r.strategy['A9s']).toEqual([{ action: 'raise', freq: 0.7 }, { action: 'fold', freq: 0.3 }]);
    expect(r.strategy['72o']).toEqual([{ action: 'fold', freq: 1 }]);
    expect(Object.keys(r.strategy)).toHaveLength(169);
  });

  it('converts BB-defense scenarios: vs_RFI with villain + open size; 3-bet value/bluff map to raise, Call to call', () => {
    const rows = [
      ...scenarioRows('BB Defense vs BTN 2.5bb 6-max', {
        AA: { action: '3-Bet (value)', freq: 100 },
        T9s: { action: '3-Bet (bluff)', freq: 40 },
        KQo: { action: 'Call', freq: 100 },
      }),
      ...scenarioRows('BB Defense vs SB 3bb (BvB)', { AA: { action: '3-Bet (value)', freq: 100 } }),
    ];
    const ds = convertCalibratedRows(rows, { name: 'Test' });
    expect(ds.ranges).toHaveLength(2);
    const vsBtn = ds.ranges.find(r => r.villainPosition === 'BTN')!;
    expect(vsBtn).toMatchObject({ scenario: 'vs_RFI', heroPosition: 'BB', openSizeBb: 2.5 });
    expect(vsBtn.strategy['AA']).toEqual([{ action: 'raise', freq: 1 }]);
    expect(vsBtn.strategy['T9s']).toEqual([{ action: 'raise', freq: 0.4 }, { action: 'fold', freq: 0.6 }]);
    expect(vsBtn.strategy['KQo']).toEqual([{ action: 'call', freq: 1 }]);
    expect(ds.ranges.find(r => r.villainPosition === 'SB')!.openSizeBb).toBe(3);
  });

  it('FAIL-CLOSED: unknown scenario, unknown action, missing hands, or mixed tiers all throw', () => {
    expect(() => convertCalibratedRows(scenarioRows('Push/Fold SB 12bb (first-in)'), { name: 'x' }))
      .toThrow(/scenario/i);
    expect(() => convertCalibratedRows(scenarioRows('RFI UTG 100bb 6-max', { AA: { action: 'Limp', freq: 100 } }), { name: 'x' }))
      .toThrow(/action/i);
    expect(() => convertCalibratedRows(scenarioRows('RFI UTG 100bb 6-max').slice(0, 168), { name: 'x' }))
      .toThrow(/hand/i);
    const mixedTier = scenarioRows('RFI UTG 100bb 6-max');
    mixedTier[0] = { ...mixedTier[0], VerificationTier: 'Nash-Solved' };
    expect(() => convertCalibratedRows(mixedTier, { name: 'x' })).toThrow(/tier/i);
  });
});

describe('tierLabel — the honest, confident chip text (Q1.1 decision 1a)', () => {
  const ds = (over: Partial<RangeDataset>): RangeDataset =>
    ({ schemaVersion: 1, name: 'x', isIllustrative: false, ranges: [], ...over });

  it('derives from the dataset tier — never claims above the data', () => {
    expect(tierLabel(ds({ verificationTier: 'calibrated' }))).toBe('Expert-calibrated range');
    expect(tierLabel(ds({ verificationTier: 'solver' }))).toBe('Solver-verified range');
    expect(tierLabel(ds({ verificationTier: 'illustrative', isIllustrative: true }))).toBe('Training range');
  });

  it('legacy datasets without a tier fall back on isIllustrative — and never say GTO', () => {
    expect(tierLabel(ds({ isIllustrative: true }))).toBe('Training range');
    expect(tierLabel(ds({ isIllustrative: false }))).toBe('Expert-calibrated range');
    expect(tierLabel(ds({ isIllustrative: false }))).not.toMatch(/GTO/);
  });
});
