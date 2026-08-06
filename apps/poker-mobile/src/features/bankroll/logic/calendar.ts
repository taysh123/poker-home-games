/**
 * Bankroll calendar/heatmap logic (B3) — pure functions, LOCAL calendar days/months via
 * localDayKey/localMonthKey (features/study/logic/localDay.ts). The UTC-ISO shortcut
 * (toISOString().slice(0, 7|10)) is banned repo-wide by dayKeyBan.test.ts — every bucket key
 * here goes through those two helpers, never a raw ISO slice.
 */
import { localDayKey, localMonthKey } from '../../study/logic/localDay';
import { sessionNetCents } from './bankrollAnalytics';
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
   * `sessionCount` distinguishes them if a caller needs to). Magnitude (1..levelCount) is
   * RELATIVE to the largest |netCents| in this dataset, not a fixed cents threshold, so it stays
   * meaningful whether the player logs $5 or $5,000 sessions. Colour/exact level count is a B4
   * taste decision — this only supplies the bucketed number.
   */
  level: number;
}

/**
 * Bucket each active day's net into `levelCount` signed intensity levels for a heatmap.
 * `levelCount` is clamped to a positive integer (falling back to the default 4 for
 * non-finite input) — an unguarded 0 collapses every real day to the same level as "no
 * session", and a negative value INVERTS every day's sign (a winner reads as the biggest
 * loser), silently defeating the whole point of the heatmap. Fleet-found (2026-08-05):
 * levelCount is caller-supplied (e.g. from screen width or a density setting in the future
 * B4-B7 heatmap UI), so it can't be assumed to always be a sane positive integer.
 */
export function heatmapLevels(sessions: BankrollSession[], levelCount = 4): DayHeatLevel[] {
  const safeLevelCount = Number.isFinite(levelCount) ? Math.max(1, Math.floor(levelCount)) : 4;
  const buckets = dayBuckets(sessions);
  const maxAbsNet = buckets.reduce((max, b) => Math.max(max, Math.abs(b.netCents)), 0);
  return buckets.map(b => {
    if (b.netCents === 0 || maxAbsNet === 0) return { ...b, level: 0 };
    const magnitude = Math.ceil((Math.abs(b.netCents) / maxAbsNet) * safeLevelCount);
    return { ...b, level: Math.sign(b.netCents) * magnitude };
  });
}

/**
 * Heat levels for ONE local month, scaled against that month's own biggest day (B5).
 *
 * The scoping is the point. `heatmapLevels` ramps relative to the largest |netCents| in the set
 * it is given, so handing it the full history would measure every month against the all-time
 * best day — one huge night in March would flatten every other month to step 1. A month view
 * should read "within this month", so the filter belongs here, next to the ramp it affects,
 * where it can be tested. Do NOT inline this in a screen: screens are not unit-tested in this
 * repo, so a future refactor passing the unscoped set would go unnoticed.
 */
export function monthHeatLevels(
  sessions: BankrollSession[],
  monthKey: string,
  levelCount = 4,
): DayHeatLevel[] {
  return heatmapLevels(
    sessions.filter(s => localMonthKey(new Date(s.startedAt)) === monthKey),
    levelCount,
  );
}
