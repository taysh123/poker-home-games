// apps/poker-mobile/src/features/study/logic/dailyLimits.ts
/**
 * Daily free-limit logic (Phase 1) — PURE, testable. Decides whether a free user may do one more
 * metered interactive rep today, and how many remain. Premium bypasses (unlimited). Counters are
 * date-stamped: a counter only counts toward today when its dayKey === todayKey, so a new local day
 * resets the allowance automatically. No I/O, no React, no Date.now — the caller passes todayKey.
 */
import { FREE_DAILY_LIMITS, type DailyLimitKind } from '../config';

export type { DailyLimitKind };

/** One metered activity's progress for a single local day. */
export interface DailyLimitCounter {
  /** YYYY-MM-DD the count applies to. Empty string = never used. */
  dayKey: string;
  /** Reps done on dayKey. */
  count: number;
}

export type DailyLimitCounters = Record<DailyLimitKind, DailyLimitCounter>;

export interface LimitStatus {
  /** True when the user may do one more rep now. */
  allowed: boolean;
  /** Reps left today (Infinity for premium). */
  remaining: number;
}

/** Fresh counters (no day, zero counts). */
export function emptyDailyCounters(): DailyLimitCounters {
  return { quiz: { dayKey: '', count: 0 }, trainerSession: { dayKey: '', count: 0 } };
}

/** Count applied to today only (0 if the stored counter belongs to another day). */
function countToday(counters: DailyLimitCounters, kind: DailyLimitKind, todayKey: string): number {
  const c = counters[kind];
  return c.dayKey === todayKey ? c.count : 0;
}

/** Reps remaining today. Infinity for premium. Never negative for free. */
export function remainingToday(
  counters: DailyLimitCounters,
  kind: DailyLimitKind,
  todayKey: string,
  isPremium: boolean,
): number {
  if (isPremium) return Infinity;
  const used = countToday(counters, kind, todayKey);
  return Math.max(0, FREE_DAILY_LIMITS[kind] - used);
}

/** Whether one more rep is allowed now, plus the remaining count. */
export function limitStatus(
  counters: DailyLimitCounters,
  kind: DailyLimitKind,
  todayKey: string,
  isPremium: boolean,
): LimitStatus {
  const remaining = remainingToday(counters, kind, todayKey, isPremium);
  return { allowed: remaining > 0, remaining };
}

/** Record one rep for today (resets to 1 on a new day). Pure — returns new counters. */
export function consumeToday(
  counters: DailyLimitCounters,
  kind: DailyLimitKind,
  todayKey: string,
): DailyLimitCounters {
  const isToday = counters[kind].dayKey === todayKey;
  return { ...counters, [kind]: { dayKey: todayKey, count: (isToday ? counters[kind].count : 0) + 1 } };
}
