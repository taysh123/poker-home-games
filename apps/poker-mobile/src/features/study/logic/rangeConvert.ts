/**
 * Q1.1 — converts the content-repo's per-hand range rows (range_viewer_database shape: one row
 * per hand, pure or single-action mixed frequency, remainder = fold) into the app's
 * RangeDataset. FAIL-CLOSED by design: unknown scenarios/actions, incomplete grids, or mixed
 * verification tiers throw — a content drop the converter doesn't fully understand must fail
 * tests/CI, never ship as a wrong range. (Push/fold + 3bet/4bet/squeeze scenarios arrive with
 * the Q3.4 converter extension; this covers the RFI + BB-defense family the trainer consumes.)
 */
import type { ActionFrequency, HandStrategy, PreflopRange, RangeAction, RangeDataset } from '../types';
import { allHands } from './handGrid';

export interface CalibratedRangeRow {
  Scenario: string;
  Hand: string;
  Action: string;
  Frequency: number; // percent 0..100
  VerificationTier: string;
}

const ACTION_MAP: Record<string, RangeAction> = {
  'Raise': 'raise',
  'Raise (mixed)': 'raise',
  '3-Bet (value)': 'raise',
  '3-Bet (bluff)': 'raise',
  'Call': 'call',
  'Fold': 'fold',
};

interface ScenarioMeta {
  scenario: 'RFI' | 'vs_RFI';
  heroPosition: string;
  villainPosition?: string;
  stackBb: number;
  tableSize: number;
  openSizeBb?: number;
  label: string;
}

function parseScenario(name: string): ScenarioMeta {
  const rfi = /^RFI (\w+) (\d+)bb (\d+)-max$/.exec(name);
  if (rfi) {
    return {
      scenario: 'RFI', heroPosition: rfi[1], stackBb: Number(rfi[2]), tableSize: Number(rfi[3]),
      label: `${rfi[1]} open (${rfi[2]}bb)`,
    };
  }
  const def = /^BB Defense vs (\w+) ([\d.]+)bb(?: (\d+)-max| \(BvB\))$/.exec(name);
  if (def) {
    return {
      scenario: 'vs_RFI', heroPosition: 'BB', villainPosition: def[1],
      stackBb: 100, tableSize: def[3] ? Number(def[3]) : 6, openSizeBb: Number(def[2]),
      label: `BB defend vs ${def[1]} ${def[2]}bb`,
    };
  }
  throw new Error(`rangeConvert: unsupported scenario "${name}"`);
}

function toStrategyEntry(row: CalibratedRangeRow): ActionFrequency[] {
  const action = ACTION_MAP[row.Action];
  if (!action) throw new Error(`rangeConvert: unknown action "${row.Action}" (${row.Scenario} ${row.Hand})`);
  // Source encodes fold rows with Frequency 0 OR 100 — either way the hand folds pure.
  if (action === 'fold') return [{ action: 'fold', freq: 1 }];
  const freq = row.Frequency / 100;
  if (!(freq > 0 && freq <= 1)) throw new Error(`rangeConvert: bad frequency ${row.Frequency} (${row.Scenario} ${row.Hand})`);
  if (freq === 1) return [{ action, freq: 1 }];
  // One-action mixed encoding: the remainder folds. Round to kill float dust (0.7/0.3, not 0.30000000000000004).
  const rem = Math.round((1 - freq) * 1000) / 1000;
  return [{ action, freq }, { action: 'fold', freq: rem }];
}

export function convertCalibratedRows(rows: CalibratedRangeRow[], opts: { name: string }): RangeDataset {
  const byScenario = new Map<string, CalibratedRangeRow[]>();
  for (const row of rows) {
    const list = byScenario.get(row.Scenario) ?? [];
    list.push(row);
    byScenario.set(row.Scenario, list);
  }

  const tiers = new Set(rows.map(r => r.VerificationTier));
  if (tiers.size !== 1 || !tiers.has('Calibrated')) {
    throw new Error(`rangeConvert: expected a uniform 'Calibrated' tier, got [${[...tiers].join(', ')}]`);
  }

  const canonical = allHands();
  const ranges: PreflopRange[] = [];
  for (const [name, scenarioRows] of byScenario) {
    const meta = parseScenario(name);
    const strategy: HandStrategy = {};
    for (const row of scenarioRows) {
      if (strategy[row.Hand]) throw new Error(`rangeConvert: duplicate hand ${row.Hand} in "${name}"`);
      strategy[row.Hand] = toStrategyEntry(row);
    }
    const missing = canonical.filter(h => !strategy[h]);
    if (missing.length > 0) {
      throw new Error(`rangeConvert: "${name}" is missing ${missing.length} hands (first: ${missing[0]})`);
    }
    ranges.push({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      format: 'cash',
      tableSize: meta.tableSize,
      stackBb: meta.stackBb,
      scenario: meta.scenario,
      heroPosition: meta.heroPosition,
      villainPosition: meta.villainPosition,
      openSizeBb: meta.openSizeBb,
      label: meta.label,
      strategy,
    });
  }

  return { schemaVersion: 1, name: opts.name, isIllustrative: false, verificationTier: 'calibrated', ranges };
}

/** The chip/label text for a dataset — derived from the data's OWN tier so the UI can never
 * claim above what the content is (decision 1a). Legacy fallback: illustrative → the confident
 * "Training range"; non-illustrative datasets are our calibrated ones ("GTO play" is gone —
 * solver claims only ever come from imported packs that carry an explicit 'solver' tier). */
export function tierLabel(dataset: Pick<RangeDataset, 'isIllustrative' | 'verificationTier'>): string {
  const tier = dataset.verificationTier ?? (dataset.isIllustrative ? 'illustrative' : 'calibrated');
  if (tier === 'solver') return 'Solver-verified range';
  if (tier === 'calibrated') return 'Expert-calibrated range';
  return 'Training range';
}
