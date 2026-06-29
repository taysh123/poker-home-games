/**
 * Trainer engine — pure. Generates spots and grades answers against a range's strategy.
 * `rng` is injected so spot selection is deterministic in tests. Powers both the Spot
 * Trainer (random across a dataset) and the Decision Trainer (a filtered subset).
 */
import type {
  ActionFrequency,
  HandKey,
  PreflopRange,
  RangeAction,
  RangeDataset,
} from '../types';

export interface Spot {
  range: PreflopRange;
  hand: HandKey;
  options: RangeAction[];
}

export interface SpotResult {
  correct: boolean;
  chosen: RangeAction;
  best: RangeAction;
  strategy: ActionFrequency[];
}

/** Buttons offered for a scenario. RFI = open or fold; facing a raise = fold/call/3bet. */
export function optionsForScenario(scenario: PreflopRange['scenario']): RangeAction[] {
  return scenario === 'RFI' ? ['fold', 'raise'] : ['fold', 'call', 'raise'];
}

const PRIORITY: Record<RangeAction, number> = { raise: 3, call: 2, fold: 1 };

/** The single highest-frequency action (ties broken raise > call > fold). */
export function bestAction(strategy: ActionFrequency[]): RangeAction {
  let best = strategy[0] ?? { action: 'fold' as RangeAction, freq: 1 };
  for (const a of strategy) {
    if (a.freq > best.freq || (a.freq === best.freq && PRIORITY[a.action] > PRIORITY[best.action])) {
      best = a;
    }
  }
  return best.action;
}

/** Grade a choice: correct when the chosen action is (one of) the max-frequency action(s). */
export function evaluateSpot(range: PreflopRange, hand: HandKey, chosen: RangeAction): SpotResult {
  const strategy = range.strategy[hand] ?? [{ action: 'fold', freq: 1 }];
  const maxFreq = Math.max(...strategy.map(a => a.freq));
  const chosenFreq = strategy.find(a => a.action === chosen)?.freq ?? 0;
  return {
    correct: maxFreq > 0 && chosenFreq >= maxFreq - 1e-9,
    chosen,
    best: bestAction(strategy),
    strategy,
  };
}

/** Pick a random range + hand from the dataset using the injected rng. */
export function generateSpot(dataset: RangeDataset, rng: () => number = Math.random): Spot {
  const range = dataset.ranges[Math.floor(rng() * dataset.ranges.length)];
  const hands = Object.keys(range.strategy);
  const hand = hands[Math.floor(rng() * hands.length)];
  return { range, hand, options: optionsForScenario(range.scenario) };
}
