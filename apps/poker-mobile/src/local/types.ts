/**
 * Local (on-device) game data model — guest mode runs entirely on these shapes,
 * persisted in AsyncStorage. Amounts are ALWAYS integer cents (see settlements.ts
 * for why). Field names deliberately mirror the backend Session/SessionPlayer/
 * BuyIn/CashOut DTOs so a future cloud import is a near-direct mapping.
 *
 * schemaVersion history:
 *   1 — cash games only (pre-tournament)
 *   2 — adds `mode` + `tournament` (fixed payout/blind presets, derived clock)
 *   3 — flexible tournaments: custom payouts[], editable blindLevels[], a stored
 *       TournamentClock (pause/resume/manual level), starting stack, rebuy/add-on
 *       toggles, late-registration window. All additive — cash games migrate no-op.
 */

export interface LocalPlayer {
  id: string;
  name: string;
}

export type LocalTxnKind = 'buyin' | 'cashout';

/** Classifies a tournament buy-in for the dashboard/stats. Undefined for cash games. */
export type LocalTxnTag = 'entry' | 'rebuy' | 'addon';

export interface LocalTxn {
  id: string;
  playerId: string;
  kind: LocalTxnKind;
  amountCents: number;
  /** ISO 8601 */
  at: string;
  tag?: LocalTxnTag;
}

export type LocalGameStatus = 'Active' | 'Finished';

/** Quick-pick seeds — the live config stores explicit values, not the preset key. */
export type PayoutPreset = '100' | '60-40' | '50-30-20';
export type BlindPreset = 'turbo' | 'standard' | 'deep';

/** One level of a (possibly custom-edited) blind structure. */
export interface BlindLevel {
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  /** Seconds this level lasts. */
  durationSeconds: number;
  /** A break (no blinds played) — the clock still runs it down. */
  isBreak?: boolean;
}

/**
 * Stored blind-clock state — replaces the old purely-derived clock so the timer
 * can be paused/resumed and levels advanced manually, surviving app reloads.
 * Time left = remainingMsAtResume − (now − lastResumeMs) while running;
 * frozen at remainingMsAtResume while paused.
 */
export interface TournamentClock {
  status: 'running' | 'paused';
  /** 0-based index into blindLevels. */
  levelIndex: number;
  /** Epoch ms when the current running segment began. */
  lastResumeMs: number;
  /** Ms remaining in the current level as of lastResumeMs. */
  remainingMsAtResume: number;
}

export interface LocalElimination {
  playerId: string;
  /** 1 = winner; assigned bottom-up as players bust. */
  position: number;
  at: string;
}

export interface LocalTournamentConfig {
  entryFeeCents: number;
  /** Payout percentages for paid places; sums to 100. length = number of winners. */
  payouts: number[];
  /** Editable blind structure (seeded from a preset). */
  blindLevels: BlindLevel[];
  clock: TournamentClock;
  /** Starting chip stack per entry — powers avg-stack / BB-left in the dashboard. */
  startingStackChips?: number;
  rebuysAllowed: boolean;
  addOnsAllowed: boolean;
  addOnAmountCents?: number;
  /** Late registration is open through this 1-based level (0/undefined = closed at start). */
  lateRegLevels?: number;
  eliminations: LocalElimination[];
}

export interface LocalGame {
  id: string;
  schemaVersion: 3;
  name: string;
  /** Local games skip Draft — they are Active from creation. */
  status: LocalGameStatus;
  /** undefined = cash game (v1 files migrate to 'cash'). */
  mode?: 'cash' | 'tournament';
  /** Present only when mode === 'tournament'. */
  tournament?: LocalTournamentConfig;
  createdAt: string;
  endedAt?: string;
  chipRatio?: number;
  defaultBuyInCents?: number;
  players: LocalPlayer[];
  txns: LocalTxn[];
  /** Set after a future "import to cloud account" — reserved, unused for now. */
  importedSessionId?: string;
}

export interface LocalGamesFile {
  schemaVersion: 3;
  games: LocalGame[];
}
