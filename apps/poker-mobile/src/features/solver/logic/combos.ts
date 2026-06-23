/**
 * Preflop combinatorics — pure, derived from the 169-hand key. This is NOT solver data: combo counts are a
 * mathematical property of the hand (pair = 6, suited = 4, offsuit = 12), so the inspector can show them
 * truthfully without any imported pack.
 */
import type { HandKey } from '../../study/types';

export const TOTAL_PREFLOP_COMBOS = 1326;

export function combosForHand(hand: HandKey): number {
  const h = hand.trim();
  if (h.length === 2) return 6;                 // pair, e.g. 'AA'
  if (h.length === 3) {
    const suffix = h[2].toLowerCase();
    if (suffix === 's') return 4;               // suited
    if (suffix === 'o') return 12;              // offsuit
  }
  return 0;                                       // unrecognized key
}

/** Frequency-weighted combo total across hands (e.g. combos taking a given action). */
export function weightedCombos(entries: { hand: HandKey; freq: number }[]): number {
  return entries.reduce((sum, e) => sum + combosForHand(e.hand) * e.freq, 0);
}
