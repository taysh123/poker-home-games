/** Canonical 13×13 preflop grid mapping (pure). Diagonal = pairs, upper triangle = suited, lower = offsuit. */
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

export function handAt(r: number, c: number): string {
  if (r === c) return RANKS[r] + RANKS[r];
  if (r < c) return RANKS[r] + RANKS[c] + 's';
  return RANKS[c] + RANKS[r] + 'o';
}
