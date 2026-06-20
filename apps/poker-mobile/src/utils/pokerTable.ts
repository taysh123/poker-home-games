/**
 * Poker-platform primitives for the immersive table system (V2.1 STEP 5.3) — PURE + testable.
 * Positions (native to the table → power future GTO/study), action metadata (premium badges), and
 * chip-stack breakdown (pot + seat visuals). No RN imports beyond the colors token object.
 */
import { colors } from '../theme/colors';

export type PokerPosition = 'UTG' | 'UTG1' | 'MP' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

/**
 * Canonical seat→position labels by table size. Index 0 = hero (bottom seat) = BTN; the rest go
 * clockwise (SB, BB, then earliest→latest). BTN/SB/BB always present (HU folds SB into BTN).
 */
const POSITION_SETS: Record<number, PokerPosition[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'MP', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'MP', 'LJ', 'HJ', 'CO'],
};

export function positionsForSeats(count: number): PokerPosition[] {
  if (count <= 1) return ['BTN'];
  return POSITION_SETS[count] ?? POSITION_SETS[6];
}

/**
 * Visual presence of a seat around the table — drives how `TableSeat` renders it.
 *  - `hero`   the studying player (premium gold highlight + glow)
 *  - `active` a player still in the hand (brighter avatar + active ring)
 *  - `folded` seated but out of the hand (dimmed silhouette, no ring)
 *  - `empty`  no player seated (dashed placeholder)
 */
export type SeatState = 'hero' | 'active' | 'folded' | 'empty';

export interface TrainerSeat { position: PokerPosition; state: SeatState }

// Preflop action order (earliest → latest to act). Used to decide, in an RFI spot,
// which seats have already folded (acted before hero) vs are still to act (after hero).
const PREFLOP_ACTION_ORDER: PokerPosition[] = ['UTG', 'UTG1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
function actionRank(p: PokerPosition): number {
  const i = PREFLOP_ACTION_ORDER.indexOf(p);
  return i < 0 ? 99 : i;
}

/**
 * Build a full ring of seats for a preflop trainer spot so the table shows EVERY player, not just
 * hero. Hero always sits at index 0 (bottom seat); the remaining seats keep clockwise order, so when
 * paired with `seatPositions` they radiate around the table. State rules (clear at a glance):
 *  - hero seat → `hero`
 *  - vs_RFI: the villain (opener) → `active`; every other seat → `folded`
 *  - RFI (folded to hero): seats yet to act after hero → `active`; earlier seats (already folded) → `folded`
 */
export function buildTrainerSeats(
  tableSize: number,
  scenario: 'RFI' | 'vs_RFI',
  heroPosition: PokerPosition,
  villainPosition?: PokerPosition,
): TrainerSeat[] {
  const ring = positionsForSeats(tableSize);
  const heroIdx = ring.indexOf(heroPosition);
  // Rotate so hero is index 0; if the position isn't in the canonical ring (data drift), seat hero first.
  const ordered: PokerPosition[] = heroIdx >= 0
    ? [...ring.slice(heroIdx), ...ring.slice(0, heroIdx)]
    : [heroPosition, ...ring.filter(p => p !== heroPosition)];
  const heroRank = actionRank(heroPosition);
  return ordered.map(position => {
    let state: SeatState;
    if (position === heroPosition) state = 'hero';
    else if (villainPosition && position === villainPosition) state = 'active';
    else if (scenario === 'RFI') state = actionRank(position) > heroRank ? 'active' : 'folded';
    else state = 'folded';
    return { position, state };
  });
}

export type PlayerAction = 'raise' | 'call' | 'check' | 'fold' | 'allin';

export interface ActionMeta { label: string; tint: string; icon: string }

/** Premium action badge metadata (label + tint + Ionicons name). */
export const ACTION_META: Record<PlayerAction, ActionMeta> = {
  raise: { label: 'Raise', tint: colors.gold, icon: 'arrow-up-circle' },
  call: { label: 'Call', tint: colors.success, icon: 'checkmark-circle' },
  check: { label: 'Check', tint: colors.textMuted, icon: 'ellipse-outline' },
  fold: { label: 'Fold', tint: colors.error, icon: 'close-circle' },
  allin: { label: 'All-In', tint: colors.goldLight, icon: 'flame' },
};

export interface Chip { value: number; color: string }

// Major-unit chip tiers (high → low) with classic casino-ish colors.
const CHIP_TIERS: Chip[] = [
  { value: 100, color: '#2C2C2C' },
  { value: 25, color: '#2E8B57' },
  { value: 5, color: '#C0392B' },
  { value: 1, color: '#ECF0F1' },
];
const MAX_CHIPS = 8; // cap for a clean stack visual

/**
 * Greedy chip breakdown of an integer-cent amount into a capped, descending list of chips for a
 * stack visual. Empty for <= 0. Purely cosmetic (no currency conversion).
 */
export function chipBreakdown(amountCents: number): Chip[] {
  let remaining = Math.floor(Math.max(0, amountCents) / 100); // whole major units
  if (remaining <= 0) return [];
  const chips: Chip[] = [];
  for (const tier of CHIP_TIERS) {
    while (remaining >= tier.value && chips.length < MAX_CHIPS) {
      chips.push(tier);
      remaining -= tier.value;
    }
    if (chips.length >= MAX_CHIPS) break;
  }
  if (chips.length === 0) chips.push(CHIP_TIERS[CHIP_TIERS.length - 1]); // tiny amount → one chip
  return chips;
}
