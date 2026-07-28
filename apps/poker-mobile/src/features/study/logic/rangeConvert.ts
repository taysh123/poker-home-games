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
  /** e.g. '100bb' — the source's own column; stackBb is DERIVED from it, never assumed. */
  EffectiveStack: string;
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

/** Table size stated in a scenario name, when it states one ('… 6-max'). */
function statedTableSize(name: string): number | null {
  const m = /(\d+)-max$/.exec(name);
  return m ? Number(m[1]) : null;
}

/** The drop's table size: every scenario that STATES one must agree, and at least one must.
 * Names like 'BB Defense vs SB 3bb (BvB)' omit it — they INHERIT this derived value instead of
 * the old hardcoded 6, and a drop that states nothing (or disagrees) now fails closed. Table
 * size is not cosmetic: it drives buildTrainerHand's seat ring. */
function dropTableSize(names: string[]): number {
  const stated = [...new Set(names.map(statedTableSize).filter((n): n is number => n != null))];
  if (stated.length === 0) throw new Error('rangeConvert: no scenario states a table size');
  if (stated.length > 1) throw new Error(`rangeConvert: mixed table sizes [${stated.join(', ')}]`);
  return stated[0];
}

/** Effective stack in bb, DERIVED from the source's own column (e.g. '100bb'). Fails closed —
 * the defense branch used to hardcode 100. */
function parseStack(effectiveStack: string, scenario: string): number {
  const m = /^([\d.]+)bb$/.exec((effectiveStack ?? '').trim());
  if (!m) throw new Error(`rangeConvert: unreadable EffectiveStack "${effectiveStack}" (${scenario})`);
  return Number(m[1]);
}

function parseScenario(name: string, tableSize: number, stackBb: number): ScenarioMeta {
  const rfi = /^RFI (\w+) [\d.]+bb \d+-max$/.exec(name);
  if (rfi) {
    return {
      scenario: 'RFI', heroPosition: rfi[1], stackBb, tableSize,
      label: `${rfi[1]} open (${stackBb}bb)`,
    };
  }
  const def = /^BB Defense vs (\w+) ([\d.]+)bb(?: \d+-max| \(BvB\))$/.exec(name);
  if (def) {
    return {
      scenario: 'vs_RFI', heroPosition: 'BB', villainPosition: def[1],
      stackBb, tableSize, openSizeBb: Number(def[2]),
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
  const tableSize = dropTableSize([...byScenario.keys()]);
  const ranges: PreflopRange[] = [];
  for (const [name, scenarioRows] of byScenario) {
    const stacks = [...new Set(scenarioRows.map(r => parseStack(r.EffectiveStack, name)))];
    if (stacks.length !== 1) throw new Error(`rangeConvert: "${name}" mixes stacks [${stacks.join(', ')}]`);
    const meta = parseScenario(name, tableSize, stacks[0]);
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

/**
 * The scope sentence for a dataset — COMPUTED from the ranges that actually ship, never written
 * by hand. A hand-written "6-max, 100bb" reads as a coverage claim while the data covers only
 * opens + big-blind defense; deriving it means the copy cannot outrun the content (the same
 * rule as `tierLabel`, applied to scope instead of tier).
 */
export function datasetScopeLine(dataset: Pick<RangeDataset, 'ranges'>): string {
  const ranges = dataset.ranges;
  if (ranges.length === 0) return '';

  const sizes = [...new Set(ranges.map(r => r.tableSize))].sort((a, b) => a - b);
  const format = sizes.map(s => `${s}-max`).join(' and ');

  const kinds: string[] = [];
  if (ranges.some(r => r.scenario === 'RFI')) kinds.push('opens');
  if (ranges.some(r => r.scenario === 'vs_RFI' && r.heroPosition === 'BB')) kinds.push('big-blind defense');
  if (ranges.some(r => r.scenario === 'vs_RFI' && r.heroPosition !== 'BB')) kinds.push('cold defense');
  const what = kinds.length <= 1
    ? kinds.join('')
    : `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}`;

  const stacks = [...new Set(ranges.map(r => r.stackBb))].sort((a, b) => a - b);
  const stack = stacks.length === 1 ? `${stacks[0]}bb` : `${stacks[0]}–${stacks[stacks.length - 1]}bb`;

  return `${format} ${what} · ${stack}`;
}

export interface SpotVerdict {
  /** 'ok' = right, 'bad' = wrong, 'mixed' = a minority action the range genuinely plays. */
  tone: 'ok' | 'bad' | 'mixed';
  title: string;
}

/**
 * The feedback verdict for one answered spot. Calibrated ranges contain genuine MIXES, and the
 * card shows the split ("Raise 58% · Fold 42%") directly under the verdict — so calling the 42%
 * action "Not quite" contradicts the very numbers beneath it. Pure spots stay binary; on a mixed
 * spot the top-frequency action is the "Main line" and a real minority action is "Also in the
 * range". An action the range never plays is still simply wrong.
 */
export function spotVerdict(
  strategy: ActionFrequency[],
  chosen: RangeAction,
  correct: boolean,
): SpotVerdict {
  const isMixed = strategy.filter(s => s.freq > 0).length > 1;
  if (correct) return { tone: 'ok', title: isMixed ? 'Main line' : 'Correct' };
  const chosenFreq = strategy.find(s => s.action === chosen)?.freq ?? 0;
  if (isMixed && chosenFreq > 0) return { tone: 'mixed', title: 'Also in the range' };
  return { tone: 'bad', title: 'Not quite' };
}

/**
 * WHY "Expert-calibrated" — provenance, recorded so this is read, not re-litigated.
 * (Owner ruling 2026-07-28, after an audit challenged the word as an unearned credential.)
 *
 * 1. IT IS A GOVERNED LABEL, NOT A COINED ONE. The content workbook's `Pack_Manifests` sheet
 *    carries a `MarketableAs` field whose rule is explicit: a pack earns "GTO / Verified-ready"
 *    only when ≥95% of its rows are Nash-Solved or Solver-Verified — otherwise it is labelled
 *    "Expert Calibrated". That sheet doesn't ship to this repo (so a grep of the shipped packs
 *    can't see it), but the SAME rule is encoded here in
 *    `features/premium/logic/marketableLabel.ts`: `GTO_VERIFIED_THRESHOLD = 95`, the
 *    `expert_calibrated` TierBadge, and the branch where a GTO/verified label below the
 *    threshold degrades to `expert_calibrated`. `MarketableAs` is rendered VERBATIM there.
 * 2. WHAT "EXPERT" REFERS TO: the owner's authorship as the domain expert calibrating the
 *    ranges against published solver consensus (the source's own
 *    `VerificationMethod = "Published solver consensus"`). It does not assert third-party
 *    verification — the shipped rows are `SolverVerified: No`, tier `Calibrated`, and the app
 *    never claims otherwise.
 * 3. WHY "Solver-calibrated" WAS REJECTED (owner, firmly): putting "Solver" in a USER-FACING
 *    label for content that is not solver-verified is MORE dangerous than "Expert", not less —
 *    a poker player reading "Solver-calibrated" will assume solver output. That drifts toward
 *    the exact overclaim this slice removed. Pinned by tierHonesty.test.ts so the swap can't be
 *    "fixed" back in later.
 */

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
