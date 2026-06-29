/**
 * Canonical preflop hand grid + range-notation parser. Pure + unit-tested.
 * Powers the compact authoring of the starter dataset and (later) a Range Viewer/Explorer.
 */
import type { ActionFrequency, HandKey, HandStrategy, RangeAction } from '../types';

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export type Rank = typeof RANKS[number];

const idx = (r: string) => RANKS.indexOf(r as Rank);

/** All 169 canonical hands (13 pairs + 78 suited + 78 offsuit), higher card first. */
export function allHands(): HandKey[] {
  const hands: HandKey[] = [];
  for (let a = RANKS.length - 1; a >= 0; a--) {
    for (let b = RANKS.length - 1; b >= 0; b--) {
      if (a === b) hands.push(`${RANKS[a]}${RANKS[a]}`);
      else if (a > b) hands.push(`${RANKS[a]}${RANKS[b]}s`);
      else hands.push(`${RANKS[b]}${RANKS[a]}o`);
    }
  }
  return hands;
}

/**
 * Expand a single range token to hand keys.
 *   "77+" → 77,88,…,AA · "ATs+" → ATs,AJs,AQs,AKs · "AJo+" → AJo,AQo,AKo
 *   "KQs"/"AQo"/"99" → the single hand. Throws on malformed tokens.
 */
export function expandToken(token: string): HandKey[] {
  const t = token.trim();
  // Pair with +  (e.g. 99+)
  let m = t.match(/^([2-9TJQKA])\1\+$/);
  if (m) {
    const from = idx(m[1]);
    return RANKS.slice(from).map(r => `${r}${r}`);
  }
  // Exact pair (e.g. TT)
  m = t.match(/^([2-9TJQKA])\1$/);
  if (m) return [`${m[1]}${m[1]}`];
  // Suited/offsuit with +  (e.g. ATs+, AJo+)
  m = t.match(/^([2-9TJQKA])([2-9TJQKA])([so])\+$/);
  if (m) {
    const hi = idx(m[1]); const loFrom = idx(m[2]); const suit = m[3];
    if (loFrom >= hi) throw new Error(`Invalid token: ${t}`);
    const out: HandKey[] = [];
    for (let lo = loFrom; lo < hi; lo++) out.push(`${RANKS[hi]}${RANKS[lo]}${suit}`);
    return out;
  }
  // Exact suited/offsuit (e.g. KQs, AQo)
  m = t.match(/^([2-9TJQKA])([2-9TJQKA])([so])$/);
  if (m) {
    if (idx(m[2]) >= idx(m[1])) throw new Error(`Invalid token: ${t}`);
    return [`${m[1]}${m[2]}${m[3]}`];
  }
  throw new Error(`Unrecognized range token: ${t}`);
}

/** Expand a comma-separated range string into a de-duplicated hand set. */
export function expandRange(notation: string): HandKey[] {
  const set = new Set<HandKey>();
  for (const tok of notation.split(',')) {
    if (tok.trim() === '') continue;
    for (const h of expandToken(tok)) set.add(h);
  }
  return [...set];
}

/**
 * Build a full 169-hand pure strategy from raise/call notation sets (raise wins ties).
 * Everything not listed folds. (Mixed-frequency strategies come from solver imports.)
 */
export function buildStrategy(sets: { raise?: string; call?: string }): HandStrategy {
  const raise = new Set(sets.raise ? expandRange(sets.raise) : []);
  const call = new Set(sets.call ? expandRange(sets.call) : []);
  const strategy: HandStrategy = {};
  for (const hand of allHands()) {
    let action: RangeAction = 'fold';
    if (raise.has(hand)) action = 'raise';
    else if (call.has(hand)) action = 'call';
    const entry: ActionFrequency[] = [{ action, freq: 1 }];
    strategy[hand] = entry;
  }
  return strategy;
}
