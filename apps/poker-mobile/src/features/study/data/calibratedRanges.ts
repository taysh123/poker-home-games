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
import type { RangeDataset } from '../types';

export const CALIBRATED_DATASET: RangeDataset = convertCalibratedRows(CALIBRATED_ROWS, {
  name: 'Expert-calibrated ranges',
});
