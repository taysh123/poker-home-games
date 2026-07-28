/**
 * Q1.1 — the committed-data gate: the full 1,521-row calibrated drop must convert fail-closed
 * into exactly the trainer's 9-range family, and the honest tier label must follow from the
 * data itself. Spot-checks pin real values from the source database so a silent regeneration
 * against wrong content fails here.
 */
import { CALIBRATED_DATASET } from '../calibratedRanges';
import { tierLabel } from '../../logic/rangeConvert';
import { allHands } from '../../logic/handGrid';
import { buildTrainerHand } from '../../../../utils/trainerHand';
import type { PokerPosition } from '../../../../utils/pokerTable';

describe('CALIBRATED_DATASET (committed content gate)', () => {
  it('is the 9-range RFI + BB-defense family, complete and uniformly calibrated', () => {
    expect(CALIBRATED_DATASET.verificationTier).toBe('calibrated');
    expect(CALIBRATED_DATASET.isIllustrative).toBe(false);
    expect(CALIBRATED_DATASET.ranges).toHaveLength(9);
    expect(CALIBRATED_DATASET.ranges.filter(r => r.scenario === 'RFI')).toHaveLength(5);
    expect(CALIBRATED_DATASET.ranges.filter(r => r.scenario === 'vs_RFI')).toHaveLength(4);
    for (const r of CALIBRATED_DATASET.ranges) {
      expect(Object.keys(r.strategy)).toHaveLength(169);
      for (const hand of allHands()) {
        const total = r.strategy[hand].reduce((s, a) => s + a.freq, 0);
        expect(total).toBeCloseTo(1, 5); // every hand's mix sums to 1
      }
    }
  });

  it('spot-checks real source values (UTG opens AA pure; UTG A9s is a 70% mixed open)', () => {
    const utg = CALIBRATED_DATASET.ranges.find(r => r.scenario === 'RFI' && r.heroPosition === 'UTG')!;
    expect(utg.strategy['AA']).toEqual([{ action: 'raise', freq: 1 }]);
    expect(utg.strategy['A9s']).toEqual([{ action: 'raise', freq: 0.7 }, { action: 'fold', freq: 0.3 }]);
    const vsBtn = CALIBRATED_DATASET.ranges.find(r => r.villainPosition === 'BTN')!;
    expect(vsBtn.heroPosition).toBe('BB');
    expect(vsBtn.openSizeBb).toBe(2.5);
  });

  it('labels honestly from its own tier', () => {
    expect(tierLabel(CALIBRATED_DATASET)).toBe('Expert-calibrated range');
  });

  it('every range builds a playable trainer hand (covers the scenarios the starter never had)', () => {
    for (const r of CALIBRATED_DATASET.ranges) {
      const snap = buildTrainerHand({
        tableSize: r.tableSize,
        scenario: r.scenario,
        heroPosition: r.heroPosition as PokerPosition,
        villainPosition: r.villainPosition as PokerPosition | undefined,
        stackBb: r.stackBb,
        openSizeBb: r.openSizeBb,
      });
      expect(snap.seats).toHaveLength(r.tableSize);
      expect(snap.seats.find(s => s.state === 'hero')).toBeDefined();
      // RFI = hero opens (nothing to call); defense = the open minus the posted big blind.
      expect(snap.toCallBb).toBeCloseTo(r.scenario === 'RFI' ? 0 : (r.openSizeBb ?? 0) - 1, 5);
    }
  });
});
