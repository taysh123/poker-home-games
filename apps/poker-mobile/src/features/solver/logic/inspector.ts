/**
 * Hover-inspector VIEW-MODEL builder (pure). Decides exactly what the inspector shows for a hand — and is the
 * single honesty gate: action frequency %, sizing, derived combo count, context, and node breadcrumb are
 * always real; EV/equity are surfaced ONLY when present in the data (never fabricated); the verification tier
 * is always labelled. Rendering (HandInspector / DetailSheet) is a thin consumer of this.
 */
import type { ActionFrequency, HandKey, PreflopRange } from '../../study/types';
import type { SolverRange, VerificationTier } from '../pack/types';
import { combosForHand } from './combos';
import { maxFreqDelta } from './compare';

export interface InspectorAction {
  action: string;
  freqPct: number;     // 0..100
  sizeBb?: number;
  evBb?: number;       // present ONLY if the underlying data has it
  equity?: number;     // present ONLY if the underlying data has it
}

export interface InspectorView {
  hand: HandKey;
  inRange: boolean;
  actions: InspectorAction[];
  comboCount: number;            // derived combinatorics (honest)
  context: string;               // position / stack / scenario
  breadcrumb: string[];          // node path or scenario fallback
  verificationTier: VerificationTier;
  hasSolverData: boolean;        // true iff any action carries evBb/equity
  diff?: { otherLabel: string; maxDelta: number };
}

export function buildInspectorView(
  range: PreflopRange | SolverRange,
  hand: HandKey,
  opts?: { tier?: VerificationTier; breadcrumb?: string[]; compareTo?: PreflopRange | SolverRange },
): InspectorView {
  const mix: ActionFrequency[] = range.strategy[hand] ?? [];
  const actions: InspectorAction[] = mix.map(a => ({
    action: a.action,
    freqPct: Math.round(a.freq * 100),
    sizeBb: a.sizeBb,
    evBb: a.evBb,        // undefined unless the data provides it
    equity: a.equity,    // undefined unless the data provides it
  }));

  const tier: VerificationTier = opts?.tier ?? (range as SolverRange).verificationTier ?? 'illustrative';
  const context = [
    range.heroPosition + (range.villainPosition ? ` vs ${range.villainPosition}` : ''),
    `${range.stackBb}bb`,
    range.scenario,
  ].join(' · ');
  const breadcrumb = opts?.breadcrumb ?? [range.scenario, range.heroPosition];
  const hasSolverData = actions.some(a => a.evBb !== undefined || a.equity !== undefined);

  // "In range" = takes a non-fold action with some frequency (pure fold@100% ⇒ not in range).
  const inRange = mix.some(a => a.action !== 'fold' && a.freq > 0);

  let diff: InspectorView['diff'];
  if (opts?.compareTo) {
    diff = { otherLabel: opts.compareTo.label, maxDelta: maxFreqDelta(mix, opts.compareTo.strategy[hand] ?? []) };
  }

  return { hand, inRange, actions, comboCount: combosForHand(hand), context, breadcrumb, verificationTier: tier, hasSolverData, diff };
}
