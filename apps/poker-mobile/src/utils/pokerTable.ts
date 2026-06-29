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

export type TrainerScenario = 'RFI' | 'vs_RFI';

// Preflop action order (earliest → latest to act). Used to decide, in an RFI spot, which seats have
// already folded (acted before hero) vs are still to act (after hero), and to walk a hand to hero.
export const PREFLOP_ACTION_ORDER: PokerPosition[] = ['UTG', 'UTG1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export function preflopActionRank(p: PokerPosition): number {
  const i = PREFLOP_ACTION_ORDER.indexOf(p);
  return i < 0 ? 99 : i;
}

/**
 * Canonical seat ring rotated so hero sits at index 0 (bottom seat); the rest keep clockwise order, so
 * paired with `seatPositions` they radiate around the table. If the position isn't in the canonical ring
 * (data drift) hero is seated first defensively.
 */
export function rotateRingToHero(tableSize: number, heroPosition: PokerPosition): PokerPosition[] {
  const ring = positionsForSeats(tableSize);
  const heroIdx = ring.indexOf(heroPosition);
  return heroIdx >= 0
    ? [...ring.slice(heroIdx), ...ring.slice(0, heroIdx)]
    : [heroPosition, ...ring.filter(p => p !== heroPosition)];
}

/**
 * Presence of a single seat in a preflop trainer spot (shared by `buildTrainerSeats` + `buildTrainerHand`):
 *  - hero seat → `hero`
 *  - vs_RFI: the villain (opener) → `active`; every other seat → `folded`
 *  - RFI (folded to hero): seats yet to act after hero → `active`; earlier seats (already folded) → `folded`
 */
export function seatStateFor(
  position: PokerPosition,
  scenario: TrainerScenario,
  heroPosition: PokerPosition,
  villainPosition?: PokerPosition,
): SeatState {
  if (position === heroPosition) return 'hero';
  if (villainPosition && position === villainPosition) return 'active';
  if (scenario === 'RFI') return preflopActionRank(position) > preflopActionRank(heroPosition) ? 'active' : 'folded';
  return 'folded';
}

/**
 * Build a full ring of seats for a preflop trainer spot so the table shows EVERY player, not just hero.
 * Hero at index 0; clockwise from there. Presence rules live in `seatStateFor` (single source of truth).
 */
export function buildTrainerSeats(
  tableSize: number,
  scenario: TrainerScenario,
  heroPosition: PokerPosition,
  villainPosition?: PokerPosition,
): TrainerSeat[] {
  return rotateRingToHero(tableSize, heroPosition).map(position => ({
    position,
    state: seatStateFor(position, scenario, heroPosition, villainPosition),
  }));
}

/**
 * Position color system — subtle, desaturated, on-brand tints so each position reads natively on the felt.
 * `bg` is a low-alpha fill over the table; `text` is the legible label color. Single source of truth shared
 * by `PositionBadge` across Study, Trainer, Summary, and future replay screens.
 */
export const POSITION_COLORS: Record<PokerPosition, { bg: string; text: string }> = {
  UTG:  { bg: 'rgba(120,144,156,0.20)', text: '#AEC2CC' }, // steel
  UTG1: { bg: 'rgba(120,144,156,0.20)', text: '#AEC2CC' },
  MP:   { bg: 'rgba(155,110,232,0.18)', text: '#BFA6EE' }, // violet
  LJ:   { bg: 'rgba(155,110,232,0.18)', text: '#BFA6EE' },
  HJ:   { bg: 'rgba(230,126,34,0.18)',  text: '#E8AE78' }, // orange
  CO:   { bg: 'rgba(243,156,18,0.20)',  text: '#F4C065' }, // amber
  BTN:  { bg: colors.goldSubtle,        text: colors.goldLight }, // the premium seat
  SB:   { bg: 'rgba(78,170,220,0.20)',  text: '#86C7EC' }, // blue
  BB:   { bg: 'rgba(39,174,96,0.20)',   text: '#5FD08C' }, // teal/green
};

export function positionColor(position?: PokerPosition): { bg: string; text: string } {
  return (position && POSITION_COLORS[position]) || { bg: colors.surfaceHigh, text: colors.textMuted };
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
