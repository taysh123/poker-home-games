/**
 * Bankroll analytics — pure functions, integer cents. No storage, no React; fully
 * unit-tested. This is the analytics FOUNDATION: it already computes more than the
 * first UI surfaces (ROI, ABI, ITM%, hourly, bankroll-over-time) so new charts/stats
 * can be added without touching the data model.
 */
import {
  DEFAULT_BANKROLL_ID,
  type BankrollGameType,
  type BankrollSession,
  type BankrollSource,
} from '../types';

/** Total amount invested in a session (all costs), integer cents. */
export function sessionCostCents(s: BankrollSession): number {
  let cost = s.feesCents;
  if (s.gameType === 'tournament' && s.tournament) {
    const t = s.tournament;
    cost += t.buyInCents + t.feeCents + t.rebuyCents + t.addOnCents;
  } else if (s.gameType === 'cash' && s.cash) {
    cost += s.cash.buyInCents;
  }
  return cost;
}

/** Total amount returned from a session (winnings), integer cents. */
export function sessionReturnCents(s: BankrollSession): number {
  if (s.gameType === 'tournament' && s.tournament) {
    return s.tournament.payoutCents + s.tournament.bountyCents;
  }
  if (s.gameType === 'cash' && s.cash) {
    return s.cash.cashOutCents;
  }
  return 0;
}

/** Net profit/loss for a session (return − cost), integer cents (may be negative). */
export function sessionNetCents(s: BankrollSession): number {
  return sessionReturnCents(s) - sessionCostCents(s);
}

/** Effective duration in minutes (explicit, else derived from start/end, else 0). */
export function sessionDurationMinutes(s: BankrollSession): number {
  if (typeof s.durationMinutes === 'number') return Math.max(0, s.durationMinutes);
  if (s.endedAt) {
    const ms = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
    if (Number.isFinite(ms) && ms > 0) return Math.round(ms / 60000);
  }
  return 0;
}

/** A tournament is "in the money" when it returned anything. */
export function isInTheMoney(s: BankrollSession): boolean {
  return s.gameType === 'tournament' && !!s.tournament && sessionReturnCents(s) > 0;
}

export interface BankrollFilter {
  /** Inclusive lower bound on startedAt (ISO 8601). */
  from?: string;
  /** Inclusive upper bound on startedAt (ISO 8601). */
  to?: string;
  gameType?: BankrollGameType;
  source?: BankrollSource;
  /** Match a specific bankroll (defaults resolve to DEFAULT_BANKROLL_ID). Dormant in V2. */
  bankrollId?: string;
  /** Match sessions carrying ANY of these tags. */
  tags?: string[];
}

export function filterSessions(sessions: BankrollSession[], f: BankrollFilter = {}): BankrollSession[] {
  return sessions.filter(s => {
    if (f.from && s.startedAt < f.from) return false;
    if (f.to && s.startedAt > f.to) return false;
    if (f.gameType && s.gameType !== f.gameType) return false;
    if (f.source && s.source !== f.source) return false;
    if (f.bankrollId && (s.bankrollId ?? DEFAULT_BANKROLL_ID) !== f.bankrollId) return false;
    if (f.tags && f.tags.length > 0 && !f.tags.some(t => s.tags.includes(t))) return false;
    return true;
  });
}

export interface BankrollSummary {
  sessionCount: number;
  cashCount: number;
  tournamentCount: number;
  totalNetCents: number;
  cashNetCents: number;
  tournamentNetCents: number;
  totalInvestedCents: number;
  tournamentInvestedCents: number;
  winningSessions: number;
  losingSessions: number;
  /** Winning sessions / total, percent (0 when no sessions). */
  winRatePct: number;
  /** Tournament ROI = tournament net / tournament invested, percent (null if no tournaments). */
  roiPct: number | null;
  /** Average tournament cost (entry + fee + rebuys + add-ons + fees), cents (null if none). */
  abiCents: number | null;
  /** In-the-money rate across tournaments, percent (null if no tournaments). */
  itmPct: number | null;
  totalDurationMinutes: number;
  /** Net per hour across sessions with known duration, cents (null if no duration logged). */
  netPerHourCents: number | null;
}

export function summarize(sessions: BankrollSession[]): BankrollSummary {
  let cashCount = 0, tournamentCount = 0;
  let totalNet = 0, cashNet = 0, tournamentNet = 0;
  let totalInvested = 0, tournamentInvested = 0;
  let winning = 0, losing = 0, itm = 0;
  let totalDuration = 0;

  for (const s of sessions) {
    const net = sessionNetCents(s);
    const cost = sessionCostCents(s);
    totalNet += net;
    totalInvested += cost;
    totalDuration += sessionDurationMinutes(s);
    if (net > 0) winning++; else if (net < 0) losing++;

    if (s.gameType === 'tournament') {
      tournamentCount++;
      tournamentNet += net;
      tournamentInvested += cost;
      if (isInTheMoney(s)) itm++;
    } else {
      cashCount++;
      cashNet += net;
    }
  }

  const sessionCount = sessions.length;
  return {
    sessionCount,
    cashCount,
    tournamentCount,
    totalNetCents: totalNet,
    cashNetCents: cashNet,
    tournamentNetCents: tournamentNet,
    totalInvestedCents: totalInvested,
    tournamentInvestedCents: tournamentInvested,
    winningSessions: winning,
    losingSessions: losing,
    winRatePct: sessionCount > 0 ? (winning / sessionCount) * 100 : 0,
    roiPct: tournamentInvested > 0 ? (tournamentNet / tournamentInvested) * 100 : null,
    abiCents: tournamentCount > 0 ? Math.round(tournamentInvested / tournamentCount) : null,
    itmPct: tournamentCount > 0 ? (itm / tournamentCount) * 100 : null,
    totalDurationMinutes: totalDuration,
    netPerHourCents: totalDuration > 0 ? Math.round((totalNet / totalDuration) * 60) : null,
  };
}

export interface BankrollPoint {
  /** startedAt of the session at this point (ISO 8601). */
  at: string;
  /** That session's net, cents. */
  netCents: number;
  /** Running bankroll after this session, cents. */
  cumulativeCents: number;
}

/**
 * Cumulative bankroll over time, oldest → newest, starting from `startingBankrollCents`.
 * Sorted by startedAt then createdAt for stable ordering of same-timestamp sessions.
 */
export function bankrollOverTime(
  sessions: BankrollSession[],
  startingBankrollCents = 0,
): BankrollPoint[] {
  const sorted = [...sessions].sort(
    (a, b) => a.startedAt.localeCompare(b.startedAt) || a.createdAt.localeCompare(b.createdAt),
  );
  let cumulative = startingBankrollCents;
  return sorted.map(s => {
    const netCents = sessionNetCents(s);
    cumulative += netCents;
    return { at: s.startedAt, netCents, cumulativeCents: cumulative };
  });
}
