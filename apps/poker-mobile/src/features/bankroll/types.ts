/**
 * Bankroll tracker domain model (V2 — Track pillar).
 *
 * Foundation of a professional poker tracking system, not a session logger. Designed
 * comprehensively up front so future analytics (ROI, ABI, ITM%, hourly, charts) need
 * NO schema migration — every field a serious tracker needs already exists, even if the
 * UI doesn't surface it yet. Conventions: money = INTEGER CENTS, ids = UUID, timestamps
 * = ISO 8601 (sync-ready for future cloud sync).
 */

export type BankrollGameType = 'cash' | 'tournament';

/** Where the session was played: through T Poker, or elsewhere (live / other apps). */
export type BankrollSource = 'in_app' | 'external';

/** Cash-game detail (present when gameType === 'cash'). */
export interface CashDetail {
  /** Total bought in across the session (initial + top-ups/rebuys), integer cents. */
  buyInCents: number;
  /** Amount cashed out at the end, integer cents. */
  cashOutCents: number;
  /** Stakes (optional, for future bb/100 + hourly context). */
  smallBlindCents?: number;
  bigBlindCents?: number;
}

/** Tournament detail (present when gameType === 'tournament'). */
export interface TournamentDetail {
  /** Entry portion that feeds the prize pool, integer cents. */
  buyInCents: number;
  /** Rake/fee portion of the entry, integer cents. */
  feeCents: number;
  /** Number of rebuys taken. */
  rebuyCount: number;
  /** Total spent on rebuys, integer cents. */
  rebuyCents: number;
  /** Number of add-ons taken. */
  addOnCount: number;
  /** Total spent on add-ons, integer cents. */
  addOnCents: number;
  /** Bounties collected (KO formats), integer cents. 0 if not applicable. */
  bountyCents: number;
  /** Total winnings (0 if no cash). */
  payoutCents: number;
  /** Field size — for ITM context / future stats. */
  entrants?: number;
  /** Finishing position — for ITM / future stats. */
  finishPlace?: number;
}

/**
 * Stable id of the "default" bankroll. V2 ships a single implicit bankroll; sessions
 * without an explicit `bankrollId` belong to it. This lets multiple bankrolls (live /
 * online / tournament / staking) be introduced later WITHOUT a data migration — the
 * field already exists and old rows resolve to DEFAULT.
 */
export const DEFAULT_BANKROLL_ID = 'default';

/** Future multi-bankroll account (dormant in V2 — no UI). */
export interface BankrollAccount {
  id: string;
  name: string;
  createdAt: string;
}

export interface BankrollSession {
  id: string;
  /** Which bankroll this session belongs to. Absent ⇒ DEFAULT_BANKROLL_ID (single-bankroll V2). */
  bankrollId?: string;
  gameType: BankrollGameType;
  source: BankrollSource;
  /** Currency code (e.g. 'ILS'); kept per-session for future multi-currency support. */
  currency: string;
  /** When play started (ISO 8601). Used for ordering, date filters, bankroll-over-time. */
  startedAt: string;
  /** When play ended (ISO 8601, optional). */
  endedAt?: string;
  /** Explicit duration when endedAt is absent — enables hourly rate / $/hr later. */
  durationMinutes?: number;
  /** Free-text venue/site ("Aria", "Home game", "PokerStars"). */
  venue?: string;
  /** Generic table fees/tips/time-charge, integer cents (separate from tournament fee). */
  feesCents: number;
  notes?: string;
  tags: string[];
  cash?: CashDetail;
  tournament?: TournamentDetail;
  /** Record bookkeeping (ISO 8601). */
  createdAt: string;
  updatedAt: string;
}

export interface BankrollSettings {
  /** Baseline bankroll the over-time series starts from, integer cents. */
  startingBankrollCents: number;
  /** Default currency applied to new sessions. */
  currency: string;
  /** Multi-bankroll accounts (dormant in V2 — reserved so the feature can be enabled later). */
  bankrolls?: BankrollAccount[];
}

export const BANKROLL_SCHEMA_VERSION = 1 as const;

/** On-device file envelope (versioned, mirrors the local-games store pattern). */
export interface BankrollFile {
  schemaVersion: typeof BANKROLL_SCHEMA_VERSION;
  settings: BankrollSettings;
  sessions: BankrollSession[];
}
