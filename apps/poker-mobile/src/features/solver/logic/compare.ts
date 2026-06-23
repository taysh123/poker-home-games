/**
 * Pure range comparison. Produces a per-hand frequency diff between two ranges' strategies — the data behind
 * the workspace "compare mode". No fabrication: it only diffs the frequencies that exist.
 */
import type { ActionFrequency, PreflopRange, RangeAction } from '../../study/types';

const ACTIONS: RangeAction[] = ['fold', 'call', 'raise'];

export interface HandDiff {
  hand: string;
  base: ActionFrequency[];
  other: ActionFrequency[];
  /** Max absolute per-action frequency delta (0..1); 0 = identical. */
  maxDelta: number;
}

export function freqOf(mix: ActionFrequency[], action: RangeAction): number {
  return mix.find(a => a.action === action)?.freq ?? 0;
}

export function maxFreqDelta(a: ActionFrequency[], b: ActionFrequency[]): number {
  return Math.max(...ACTIONS.map(act => Math.abs(freqOf(a, act) - freqOf(b, act))), 0);
}

/** Per-hand diff between two ranges, descending by magnitude. Hands in either range are considered. */
export function diffRanges(base: PreflopRange, other: PreflopRange): HandDiff[] {
  const hands = new Set([...Object.keys(base.strategy), ...Object.keys(other.strategy)]);
  const out: HandDiff[] = [];
  for (const hand of hands) {
    const b = base.strategy[hand] ?? [];
    const o = other.strategy[hand] ?? [];
    const delta = maxFreqDelta(b, o);
    if (delta > 0) out.push({ hand, base: b, other: o, maxDelta: delta });
  }
  return out.sort((x, y) => y.maxDelta - x.maxDelta);
}
