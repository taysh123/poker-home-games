/**
 * Trainer hand snapshot (V2.1) — PURE + testable. Derives a realistic preflop hand state from a trainer
 * spot's range (table size, scenario, hero/villain positions, stack + open size) so the table can show the
 * full action sequence up to hero: per-seat stacks & committed chips, who raised/folded, the pot, and what
 * hero is facing. No RN imports; no backend; no trainer-logic change. Feeds `TableScene` + `ActionTimeline`.
 */
import {
  type PokerPosition,
  type PlayerAction,
  type SeatState,
  type TrainerScenario,
  rotateRingToHero,
  seatStateFor,
  preflopActionRank,
} from './pokerTable';

export interface SeatHandState {
  position: PokerPosition;
  state: SeatState;
  /** Remaining stack (bb) after chips committed this street. */
  stackBb: number;
  /** Chips in front this street (bb) — blinds posted and/or a raise. */
  committedBb: number;
  action?: PlayerAction;
  hasActed: boolean;
  /** Seat order around the ring (0 = hero, clockwise). */
  order: number;
  /** Hero is the player to act. */
  isNext?: boolean;
  allin?: boolean;
}

export type TimelineAction = PlayerAction | 'post';
export interface TimelineStep {
  position: PokerPosition;
  /** Omitted for the hero "you're up" step. */
  action?: TimelineAction;
  amountBb?: number;
  isHero?: boolean;
}

export interface HandSnapshot {
  seats: SeatHandState[];
  potBb: number;
  /** What hero must call (bb). 0 when hero is opening (RFI). */
  toCallBb: number;
  timeline: TimelineStep[];
}

const SB_AMT = 0.5;
const BB_AMT = 1;
const DEFAULT_OPEN = 2.5;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Build a deterministic preflop snapshot up to hero's decision.
 *  - RFI: everyone before hero folds; hero is opening (toCall 0); seats after hero are still to act.
 *  - vs_RFI: the villain opens to `openSizeBb`; others fold; hero faces it.
 * Blinds are always posted (heads-up: the Button posts the small blind).
 */
export function buildTrainerHand(opts: {
  tableSize: number;
  scenario: TrainerScenario;
  heroPosition: PokerPosition;
  villainPosition?: PokerPosition;
  stackBb: number;
  openSizeBb?: number;
}): HandSnapshot {
  const { tableSize, scenario, heroPosition, villainPosition, stackBb } = opts;
  const open = opts.openSizeBb && opts.openSizeBb > 0 ? opts.openSizeBb : DEFAULT_OPEN;
  const ring = rotateRingToHero(tableSize, heroPosition); // hero index 0, clockwise

  const committed = new Map<PokerPosition, number>(ring.map(p => [p, 0]));
  const actions = new Map<PokerPosition, PlayerAction>();
  const timeline: TimelineStep[] = [];

  // Post blinds (heads-up has no SB seat → the Button posts it).
  const sbPos: PokerPosition = ring.includes('SB') ? 'SB' : 'BTN';
  committed.set(sbPos, (committed.get(sbPos) ?? 0) + SB_AMT);
  timeline.push({ position: sbPos, action: 'post', amountBb: SB_AMT });
  if (ring.includes('BB')) {
    committed.set('BB', (committed.get('BB') ?? 0) + BB_AMT);
    timeline.push({ position: 'BB', action: 'post', amountBb: BB_AMT });
  }

  // Walk preflop action order up to (but not including) hero.
  const actionOrder = [...ring].sort((a, b) => preflopActionRank(a) - preflopActionRank(b));
  for (const pos of actionOrder) {
    if (pos === heroPosition) break;
    if (scenario === 'vs_RFI' && villainPosition && pos === villainPosition) {
      committed.set(pos, open); // open size is the total committed (absorbs any blind)
      actions.set(pos, 'raise');
      timeline.push({ position: pos, action: 'raise', amountBb: open });
    } else {
      actions.set(pos, 'fold');
      timeline.push({ position: pos, action: 'fold' });
    }
  }
  // Hero is up next.
  timeline.push({ position: heroPosition, isHero: true });

  const heroCommitted = committed.get(heroPosition) ?? 0;
  const toCallBb = scenario === 'vs_RFI' ? round1(Math.max(0, open - heroCommitted)) : 0;
  const potBb = round1([...committed.values()].reduce((a, b) => a + b, 0));

  const seats: SeatHandState[] = ring.map((position, order) => {
    const c = committed.get(position) ?? 0;
    const remaining = round1(Math.max(0, stackBb - c));
    return {
      position,
      state: seatStateFor(position, scenario, heroPosition, villainPosition),
      stackBb: remaining,
      committedBb: round1(c),
      action: actions.get(position),
      hasActed: actions.has(position),
      order,
      isNext: position === heroPosition,
      allin: c > 0 && remaining <= 0,
    };
  });

  return { seats, potBb, toCallBb, timeline };
}
