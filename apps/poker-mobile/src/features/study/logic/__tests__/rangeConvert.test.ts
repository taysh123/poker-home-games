/**
 * Q1.1 — converter from the content-repo's per-hand range rows (range_viewer_database shape)
 * to the app's RangeDataset. FAIL-CLOSED: anything the converter doesn't fully understand
 * (unknown scenario, unknown action, missing hands, mixed tiers) throws — a bad content drop
 * must fail the build/tests, never ship a wrong range.
 */
import { convertCalibratedRows, datasetScopeLine, spotVerdict, tierLabel, type CalibratedRangeRow } from '../rangeConvert';
import { CALIBRATED_DATASET } from '../../data/calibratedRanges';
import type { PreflopRange, RangeDataset } from '../../types';
import { allHands } from '../handGrid';


/** Fabricate a complete 169-hand scenario: every hand folds unless overridden. */
function scenarioRows(
  scenario: string,
  overrides: Record<string, { action: string; freq: number }> = {},
  tier = 'Calibrated',
  effectiveStack = '100bb',
): CalibratedRangeRow[] {
  return allHands().map(hand => ({
    Scenario: scenario,
    Hand: hand,
    Action: overrides[hand]?.action ?? 'Fold',
    Frequency: overrides[hand]?.freq ?? 100,
    VerificationTier: tier,
    EffectiveStack: effectiveStack,
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
    // stack + table size are DERIVED, never assumed (auditor finds: the defense branch used to
    // hardcode 100bb, and a BvB name with no stated table size silently became 6-max).
    const badStack = scenarioRows('RFI UTG 100bb 6-max', {}, 'Calibrated', '??');
    expect(() => convertCalibratedRows(badStack, { name: 'x' })).toThrow(/EffectiveStack/i);
    const noSize = scenarioRows('BB Defense vs SB 3bb (BvB)');
    expect(() => convertCalibratedRows(noSize, { name: 'x' })).toThrow(/table size/i);
  });

  it('a size-less BvB scenario INHERITS the stated drop size instead of guessing', () => {
    const rows = [
      ...scenarioRows('RFI UTG 100bb 9-max'),
      ...scenarioRows('BB Defense vs SB 3bb (BvB)'),
    ];
    const ds = convertCalibratedRows(rows, { name: 'x' });
    // Old behavior hardcoded 6 here — which would deal a 6-seat table for a 9-max drop.
    expect(ds.ranges.every(r => r.tableSize === 9)).toBe(true);
  });

  it('derives stackBb from the source column, including a non-100bb drop', () => {
    const rows = scenarioRows('BB Defense vs BTN 2.5bb 6-max', {}, 'Calibrated', '40bb');
    expect(convertCalibratedRows(rows, { name: 'x' }).ranges[0].stackBb).toBe(40);
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

describe('spotVerdict — the verdict may never contradict the frequencies shown beneath it', () => {
  const pure = [{ action: 'raise' as const, freq: 1 }];
  const mixed = [{ action: 'raise' as const, freq: 0.58 }, { action: 'fold' as const, freq: 0.42 }];

  it('pure spots stay binary: right or wrong', () => {
    expect(spotVerdict(pure, 'raise', true)).toEqual({ tone: 'ok', title: 'Correct' });
    expect(spotVerdict(pure, 'fold', false)).toEqual({ tone: 'bad', title: 'Not quite' });
  });

  it('a mixed spot: the max-frequency action is the main line', () => {
    expect(spotVerdict(mixed, 'raise', true)).toEqual({ tone: 'ok', title: 'Main line' });
  });

  it('a minority action the range genuinely plays is NOT "wrong" — it is off the main line', () => {
    // Calling fold "Not quite" while the line below reads "Fold 42%" is a self-contradiction.
    expect(spotVerdict(mixed, 'fold', false)).toEqual({ tone: 'mixed', title: 'Also in the range' });
  });

  it('an action the range never plays is still wrong, mixed spot or not', () => {
    expect(spotVerdict(mixed, 'call', false)).toEqual({ tone: 'bad', title: 'Not quite' });
  });
});

describe('datasetScopeLine — the scope claim is COMPUTED from the ranges, never asserted by hand', () => {
  const mk = (ranges: Partial<PreflopRange>[]): RangeDataset => ({
    schemaVersion: 1, name: 'x', isIllustrative: false, verificationTier: 'calibrated',
    ranges: ranges.map((r, i) => ({
      id: `r${i}`, format: 'cash', tableSize: 6, stackBb: 100, scenario: 'RFI',
      heroPosition: 'BTN', label: 'l', strategy: {}, ...r,
    })) as PreflopRange[],
  });

  it('names what actually ships: opens + big-blind defense, not "6-max" in general', () => {
    const ds = mk([
      { scenario: 'RFI', heroPosition: 'UTG' },
      { scenario: 'vs_RFI', heroPosition: 'BB', villainPosition: 'BTN' },
    ]);
    expect(datasetScopeLine(ds)).toBe('6-max opens and big-blind defense · 100bb');
  });

  it('says only "opens" when no defense ranges ship', () => {
    expect(datasetScopeLine(mk([{ scenario: 'RFI' }]))).toBe('6-max opens · 100bb');
  });

  it('distinguishes cold defense (3-bet spots) from blind defense', () => {
    const ds = mk([
      { scenario: 'RFI' },
      { scenario: 'vs_RFI', heroPosition: 'BB', villainPosition: 'BTN' },
      { scenario: 'vs_RFI', heroPosition: 'SB', villainPosition: 'BTN' },
    ]);
    expect(datasetScopeLine(ds)).toBe('6-max opens, big-blind defense and cold defense · 100bb');
  });

  it('widens honestly when a drop spans several stacks or table sizes', () => {
    const ds = mk([{ stackBb: 40 }, { stackBb: 100, tableSize: 9 }]);
    expect(datasetScopeLine(ds)).toBe('6-max and 9-max opens · 40–100bb');
  });

  it('the SHIPPED dataset describes itself accurately (no cold defense today)', () => {
    expect(datasetScopeLine(CALIBRATED_DATASET)).toBe('6-max opens and big-blind defense · 100bb');
  });
});
