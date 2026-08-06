/**
 * Bankroll calendar/heatmap logic (B3) — pure functions, LOCAL calendar days/months via
 * localDayKey/localMonthKey (features/study/logic/localDay.ts). The UTC-ISO shortcut
 * (toISOString().slice(0, 7|10)) is banned repo-wide by dayKeyBan.test.ts — every bucket key
 * here goes through those two helpers, never a raw ISO slice.
 */
import { localDayKey, localMonthKey } from '../../study/logic/localDay';
import { sessionNetCents, sessionCostCents } from './bankrollAnalytics';
import type { BankrollSession } from '../types';

export interface DayBucket {
  /** LOCAL calendar day, 'YYYY-MM-DD'. */
  dayKey: string;
  sessionCount: number;
  netCents: number;
}

/** Group sessions by LOCAL calendar day. Sparse — only days with >=1 session are returned. */
export function dayBuckets(sessions: BankrollSession[]): DayBucket[] {
  const byDay = new Map<string, DayBucket>();
  for (const s of sessions) {
    const dayKey = localDayKey(new Date(s.startedAt));
    const net = sessionNetCents(s);
    const existing = byDay.get(dayKey);
    if (existing) {
      existing.sessionCount += 1;
      existing.netCents += net;
    } else {
      byDay.set(dayKey, { dayKey, sessionCount: 1, netCents: net });
    }
  }
  return [...byDay.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

export interface MonthBucket {
  /** LOCAL calendar month, 'YYYY-MM'. */
  monthKey: string;
  sessionCount: number;
  netCents: number;
}

/** Group sessions by LOCAL calendar month. Sparse — only months with >=1 session are returned. */
export function monthBuckets(sessions: BankrollSession[]): MonthBucket[] {
  const byMonth = new Map<string, MonthBucket>();
  for (const s of sessions) {
    const monthKey = localMonthKey(new Date(s.startedAt));
    const net = sessionNetCents(s);
    const existing = byMonth.get(monthKey);
    if (existing) {
      existing.sessionCount += 1;
      existing.netCents += net;
    } else {
      byMonth.set(monthKey, { monthKey, sessionCount: 1, netCents: net });
    }
  }
  return [...byMonth.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

/**
 * Net cents for ONE local month key ('YYYY-MM'), 0 if no sessions that month. The single shared
 * implementation of "this month's bankroll net" — EngagementContext's bankrollPositiveMonth
 * derives from this instead of re-filtering sessions itself (B3; was duplicated inline at
 * EngagementContext.tsx:92-100).
 */
export function netCentsForMonth(sessions: BankrollSession[], monthKey: string): number {
  return monthBuckets(sessions).find(b => b.monthKey === monthKey)?.netCents ?? 0;
}

export interface DayHeatLevel extends DayBucket {
  /**
   * Discrete shading level for calendar-heatmap rendering. Signed: positive = winning day,
   * negative = losing day, 0 = no session OR an exact break-even day (both render as neutral;
   * `sessionCount` distinguishes them if a caller needs to). Magnitude is 1..4, banded against
   * `heatReferenceCents` — a property of the PLAYER, not of whatever set is on screen.
   */
  level: number;
}

/**
 * Band edges as multiples of the heat reference: a day is step 1 below 0.5x a typical day's
 * exposure, step 2 below 1x, step 3 below 2x, and step 4 at or above 2x. Four steps, matching
 * the four-entry ramp in logic/heatCell.ts.
 */
export const HEAT_BANDS = [0.5, 1, 2] as const;

/**
 * The reference a day's net is measured against: the MEDIAN DAILY COST (buy-ins + fees) across
 * the player's history. Returns 0 when no usable cost exists.
 *
 * Why a property of the PLAYER and not of the visible set — the previous ramp scaled against
 * `max(|net|)` in whatever set it was handed, which was unstable three ways (all measured):
 *   - Saturation: a lone $20 night painted step 4, being trivially its own maximum. `$20, $19,
 *     $18` painted 4, 4, 4.
 *   - Compression: one $5,000 night alongside 20 normal nights collapsed all 20 to step 1.
 *   - Cross-view: the SAME $100 day rendered step 4 scoped to a quiet month and step 1 scoped
 *     to the year. Two views of one day, disagreeing — which is why this had to be settled
 *     before the year heatmap inherits the ramp.
 * A reference derived from the player's typical stake fixes all three and self-calibrates: a
 * $1/$2 player and a $25/$50 player each get a meaningful ramp, with no hardcoded cents.
 *
 * DAILY cost, not per-session: the calendar's unit is the day, so a two-session day is measured
 * against two buy-ins of exposure rather than one. MEDIAN, not mean, so a single huge rebuy
 * night cannot drag the reference.
 *
 * Small n is not a special case here, and that is the point of choosing cost over a percentile
 * of outcomes: cost is known from the FIRST session and is independent of how that session went,
 * so one $20 win against a $100 buy-in correctly reads as small. (A percentile of daily nets
 * degenerates instead — with one day of history, p80 IS that day, so it saturates.) The only
 * degenerate input is having no usable cost at all; see `heatmapLevels`.
 */
export function heatReferenceCents(sessions: BankrollSession[]): number {
  const costByDay = new Map<string, number>();
  for (const s of sessions) {
    const dayKey = localDayKey(new Date(s.startedAt));
    costByDay.set(dayKey, (costByDay.get(dayKey) ?? 0) + sessionCostCents(s));
  }
  const costs = [...costByDay.values()].filter(c => c > 0).sort((a, b) => a - b);
  if (costs.length === 0) return 0;
  const mid = costs.length >> 1;
  return costs.length % 2 === 1 ? costs[mid] : Math.round((costs[mid - 1] + costs[mid]) / 2);
}

/**
 * Bucket each active day's net into signed intensity levels, banded against `referenceCents`
 * (from `heatReferenceCents`). The reference is an explicit parameter with no default, so a
 * caller cannot silently fall back to set-relative scaling.
 *
 * FALLBACK, stated rather than implied: when the reference is unusable (0, negative, NaN — i.e.
 * a player with no session carrying a positive cost), every non-zero day renders at step 1. It
 * does not blaze and it does not throw: the day is still marked as played and still carries its
 * sign, and only the magnitude — which genuinely cannot be known without a reference — is
 * withheld. Returning 0 instead would be wrong, because 0 already means "broke even".
 */
export function heatmapLevels(sessions: BankrollSession[], referenceCents: number): DayHeatLevel[] {
  const usable = Number.isFinite(referenceCents) && referenceCents > 0;
  return dayBuckets(sessions).map(b => {
    if (b.netCents === 0) return { ...b, level: 0 };
    if (!usable) return { ...b, level: Math.sign(b.netCents) };
    const ratio = Math.abs(b.netCents) / referenceCents;
    const step = ratio < HEAT_BANDS[0] ? 1 : ratio < HEAT_BANDS[1] ? 2 : ratio < HEAT_BANDS[2] ? 3 : 4;
    return { ...b, level: Math.sign(b.netCents) * step };
  });
}

/**
 * Heat levels for the days of ONE local month.
 *
 * Takes the player's FULL history and does both halves itself, deliberately: the reference is
 * computed from everything (so the ramp is stable and matches the year view), while the days
 * returned are only that month's. Splitting those two responsibilities across a screen would
 * put the load-bearing asymmetry somewhere unpinnable — screens are not unit-tested here, so a
 * refactor that derived the reference from the visible month instead would reinstate exactly
 * the set-relative bug this replaced, silently.
 */
export function monthHeatLevels(sessions: BankrollSession[], monthKey: string): DayHeatLevel[] {
  return heatmapLevels(
    sessions.filter(s => localMonthKey(new Date(s.startedAt)) === monthKey),
    heatReferenceCents(sessions),
  );
}
