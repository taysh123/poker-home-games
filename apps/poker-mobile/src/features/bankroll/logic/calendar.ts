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

/** Bucket each active day's net into `levelCount` signed intensity levels for a heatmap. */
export function heatmapLevels(sessions: BankrollSession[], levelCount = 4): DayHeatLevel[] {
  const buckets = dayBuckets(sessions);
  const maxAbsNet = buckets.reduce((max, b) => Math.max(max, Math.abs(b.netCents)), 0);
  return buckets.map(b => {
    if (b.netCents === 0 || maxAbsNet === 0) return { ...b, level: 0 };
    const magnitude = Math.ceil((Math.abs(b.netCents) / maxAbsNet) * levelCount);
    return { ...b, level: Math.sign(b.netCents) * magnitude };
  });
}
