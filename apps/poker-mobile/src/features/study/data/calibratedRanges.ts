/**
 * Q1.1 — the trainer/study dataset: 9 expert-calibrated ranges (5 RFI + 4 BB-defense, 100bb
 * 6-max) converted from the content repo's approved range_viewer_database. Converted at module
 * load (pure, one pass over 1,521 rows); the conversion is FAIL-CLOSED and the committed data
 * is validated by data/__tests__/calibratedRanges.test.ts, so a bad content drop fails CI —
 * it cannot reach a user. The illustrative starter pack remains only as the solver workspace's
 * placeholder source (features/solver, prod-OFF).
 */
import { convertCalibratedRows } from '../logic/rangeConvert';
import { CALIBRATED_ROWS } from './calibratedRows';
import { STARTER_DATASET } from './starterRanges';
import type { RangeDataset } from '../types';

/**
 * Fail-SAFE at runtime, fail-CLOSED in CI. The conversion runs at module load inside the root
 * provider tree, so an uncaught throw would white-screen the whole app — including the
 * money-critical live-session screens — not just Study. A bad drop therefore degrades to the
 * illustrative starter pack instead, and because the UI label is derived from the dataset's own
 * tier, that fallback AUTOMATICALLY relabels itself "Training range": degradation stays honest
 * with no extra branch. CI still refuses the bad drop (data/__tests__/calibratedRanges.test.ts).
 */
function loadCalibrated(): RangeDataset {
  try {
    return convertCalibratedRows(CALIBRATED_ROWS, { name: 'Expert-calibrated ranges' });
  } catch {
    return STARTER_DATASET;
  }
}

export const CALIBRATED_DATASET: RangeDataset = loadCalibrated();
