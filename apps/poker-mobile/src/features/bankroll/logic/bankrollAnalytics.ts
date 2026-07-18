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

// ──────────────────────────────────────────────────────────────────────────────
// Advanced (risk) analytics — variance/std-dev, max drawdown, best/worst, histogram.
// A companion to `summarize` so the everyday summary stays lean and these heavier
// risk metrics stay opt-in. All integer cents, pure, deterministic.
// ──────────────────────────────────────────────────────────────────────────────

export interface AdvancedStats {
  /** Number of sessions analysed (n). */
  count: number;
  /** Mean per-session net, integer cents (null when n = 0). */
  meanNetCents: number | null;
  /**
   * Sample variance (n−1 estimator) of per-session net, in cents² (null when n < 2).
   * Unit is cents² (variance of cent-denominated values) — surface std-dev, not this, in UI.
   */
  varianceCents2: number | null;
  /** Sample standard deviation (n−1) of per-session net, integer cents (null when n < 2). */
  stdDevCents: number | null;
  /** Biggest single-session win (max net), integer cents (null when n = 0). */
  bestNetCents: number | null;
  /** Biggest single-session loss (min net), integer cents (null when n = 0). */
  worstNetCents: number | null;
  /** Largest peak-to-trough drop on the cumulative bankroll series, integer cents (≥ 0). */
  maxDrawdownCents: number;
}

/**
 * Maximum drawdown — the largest peak-to-trough drop across the cumulative series, in
 * cents (always ≥ 0; 0 for an empty, single-point, or monotonically non-decreasing
 * series). The high-water mark is seeded from the FIRST plotted point, matching what
 * the bankroll chart shows; the result is therefore shift-invariant (independent of the
 * starting-bankroll baseline, which only offsets every point by the same constant).
 */
export function maxDrawdownCents(points: BankrollPoint[]): number {
  if (points.length < 2) return 0;
  let peak = points[0].cumulativeCents;
  let maxDrawdown = 0;
  for (let i = 1; i < points.length; i++) {
    const c = points[i].cumulativeCents;
    if (c > peak) peak = c;
    else {
      const dd = peak - c;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  }
  return maxDrawdown;
}

export interface NetHistogramBin {
  /** Inclusive lower bound, integer cents. */
  fromCents: number;
  /** Upper bound, integer cents (exclusive, except the last bin which includes max). */
  toCents: number;
  /** Number of sessions whose net falls in this bin. */
  count: number;
}

/**
 * Distribution of per-session net into `binCount` equal-width bins across [min, max].
 * Returns [] for no sessions and a single bin when every session nets the same. Bin
 * edges are rounded to integer cents; bucket assignment uses the exact ratio so every
 * session lands in exactly one bin (counts always sum to n).
 */
export function sessionNetHistogram(sessions: BankrollSession[], binCount = 7): NetHistogramBin[] {
  const nets = sessions.map(sessionNetCents);
  if (nets.length === 0) return [];
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  if (min === max) return [{ fromCents: min, toCents: max, count: nets.length }];

  const span = max - min;
  const bins: NetHistogramBin[] = [];
  for (let i = 0; i < binCount; i++) {
    bins.push({
      fromCents: min + Math.round((span * i) / binCount),
      toCents: min + Math.round((span * (i + 1)) / binCount),
      count: 0,
    });
  }
  bins[binCount - 1].toCents = max; // pin the final edge exactly to max
  for (const x of nets) {
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor(((x - min) / span) * binCount)));
    bins[idx].count++;
  }
  return bins;
}

/** Advanced risk metrics over a set of sessions (companion to `summarize`). */
export function advancedStats(sessions: BankrollSession[]): AdvancedStats {
  const n = sessions.length;
  if (n === 0) {
    return {
      count: 0,
      meanNetCents: null,
      varianceCents2: null,
      stdDevCents: null,
      bestNetCents: null,
      worstNetCents: null,
      maxDrawdownCents: 0,
    };
  }

  const nets = sessions.map(sessionNetCents);
  const mean = nets.reduce((a, b) => a + b, 0) / n;
  let best = nets[0];
  let worst = nets[0];
  for (const x of nets) {
    if (x > best) best = x;
    if (x < worst) worst = x;
  }

  let varianceCents2: number | null = null;
  let stdDevCents: number | null = null;
  if (n >= 2) {
    const ss = nets.reduce((acc, x) => acc + (x - mean) * (x - mean), 0);
    const variance = ss / (n - 1); // sample (n−1) estimator
    varianceCents2 = Math.round(variance);
    stdDevCents = Math.round(Math.sqrt(variance));
  }

  return {
    count: n,
    meanNetCents: Math.round(mean),
    varianceCents2,
    stdDevCents,
    bestNetCents: best,
    worstNetCents: worst,
    maxDrawdownCents: maxDrawdownCents(bankrollOverTime(sessions)),
  };
}
