/**
 * Bundled STARTER range dataset — illustrative TRAINING content, not solver output.
 * `isIllustrative: true` everywhere; the UI must label it as such. Authored compactly
 * via range notation and expanded by handGrid. Replace/extend by importing a verified
 * RangeDataset (same shape) via the import format — no code changes needed.
 *
 * Scope: 6-max cash, 100bb — a few RFI spots + one defend spot. Enough to train daily.
 */
import type { PreflopRange, RangeDataset } from '../types';
import { buildStrategy } from '../logic/handGrid';

const cash100 = (
  id: string,
  heroPosition: string,
  scenario: PreflopRange['scenario'],
  label: string,
  sets: { raise?: string; call?: string },
  extra: Partial<PreflopRange> = {},
): PreflopRange => ({
  id,
  format: 'cash',
  tableSize: 6,
  stackBb: 100,
  scenario,
  heroPosition,
  label,
  openSizeBb: 2.5,
  strategy: buildStrategy(sets),
  ...extra,
});

export const STARTER_DATASET: RangeDataset = {
  schemaVersion: 1,
  name: 'Illustrative Starter Pack',
  isIllustrative: true,
  ranges: [
    cash100('rfi-utg', 'UTG', 'RFI', 'UTG open · 6-max 100bb', {
      raise: '77+, AJs+, KQs, AQo+',
    }),
    cash100('rfi-co', 'CO', 'RFI', 'CO open · 6-max 100bb', {
      raise: '22+, A2s+, K9s+, Q9s+, JTs, T9s, 98s, ATo+, KJo+',
    }),
    cash100('rfi-btn', 'BTN', 'RFI', 'BTN open · 6-max 100bb', {
      raise: '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A2o+, K9o+, Q9o+, J9o+, T9o',
    }),
    cash100('rfi-sb', 'SB', 'RFI', 'SB open · 6-max 100bb', {
      raise: '22+, A2s+, K7s+, Q9s+, J9s+, T9s, A8o+, KTo+, QJo',
    }),
    cash100('bb-vs-btn', 'BB', 'vs_RFI', 'BB defend vs BTN open · 6-max 100bb', {
      raise: 'TT+, AQs+, AKo, A5s, A4s',
      call: '22+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, 65s, KJo+, QJo, AJo+',
    }, { villainPosition: 'BTN' }),
  ],
};
