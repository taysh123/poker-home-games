/**
 * Study progress + streak logic — pure, testable (functions take an explicit "today"
 * so date math is deterministic). Drives daily habit formation: streaks, daily goal,
 * accuracy.
 */
import { STUDY_SCHEMA_VERSION, type StudyProgress } from '../types';
import { emptyDailyCounters, consumeToday, type DailyLimitCounters } from './dailyLimits';

export const DEFAULT_DAILY_GOAL = 10;
export const MIN_DAILY_GOAL = 3;
export const MAX_DAILY_GOAL = 25;

export function emptyProgress(dailyGoal = DEFAULT_DAILY_GOAL): StudyProgress {
  return {
    schemaVersion: STUDY_SCHEMA_VERSION,
    totalAnswered: 0,
    totalCorrect: 0,
    dailyGoal,
    dailyCounts: {},
    currentStreak: 0,
    longestStreak: 0,
    frozenDays: [],
    freezeTokens: 0,
    dailyLimitCounters: emptyDailyCounters(),
    quizzesCompleted: 0,
    lessonsCompleted: 0,
  };
}

const MS_PER_DAY = 86400000;
const dayNumber = (key: string) => Math.floor(new Date(`${key}T00:00:00.000Z`).getTime() / MS_PER_DAY);
const dayKeyFromNumber = (n: number) => new Date(n * MS_PER_DAY).toISOString().slice(0, 10);

/** Set the daily goal, clamped to a sane range. Pure. */
export function setDailyGoal(p: StudyProgress, goal: number): StudyProgress {
  const clamped = Math.max(MIN_DAILY_GOAL, Math.min(MAX_DAILY_GOAL, Math.round(goal)));
  return { ...p, dailyGoal: clamped };
}

/**
 * Current + longest streak from the studied days.
 *   longest = longest run of consecutive calendar days with ≥1 spot.
 *   current = run ending today or yesterday (a day is "alive" until it ends), else 0.
 */
export function computeStreaks(
  dailyCounts: Record<string, number>,
  todayKey: string,
): { current: number; longest: number } {
  const days = Object.keys(dailyCounts)
    .filter(k => dailyCounts[k] > 0)
    .map(dayNumber)
    .sort((a, b) => a - b);
  if (days.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // current: walk back from the most recent studied day, but only if it's today/yesterday.
  const today = dayNumber(todayKey);
  const last = days[days.length - 1];
  let current = 0;
  if (last === today || last === today - 1) {
    current = 1;
    for (let i = days.length - 2; i >= 0; i--) {
      if (days[i] === days[i + 1] - 1) current++;
      else break;
    }
  }
  return { current, longest };
}

/**
 * Like computeStreaks, but `frozenDays` (yyyy-mm-dd) count as studied for continuity — a single
 * frozen day bridges a gap. With no frozen days this is identical to computeStreaks.
 */
export function computeStreaksWithFreeze(
  dailyCounts: Record<string, number>,
  todayKey: string,
  frozenDays: string[],
): { current: number; longest: number } {
  const covered = new Set<number>();
  for (const k of Object.keys(dailyCounts)) if (dailyCounts[k] > 0) covered.add(dayNumber(k));
  for (const f of frozenDays) covered.add(dayNumber(f));
  const days = [...covered].sort((a, b) => a - b);
  if (days.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const today = dayNumber(todayKey);
  const last = days[days.length - 1];
  let current = 0;
  if (last === today || last === today - 1) {
    current = 1;
    for (let i = days.length - 2; i >= 0; i--) {
      if (days[i] === days[i + 1] - 1) current++;
      else break;
    }
  }
  return { current, longest };
}

/**
 * If exactly yesterday was missed (last studied = day before yesterday) and a freeze token is
 * available, freeze yesterday so today continues the streak. Single-day bridge only. Pure.
 */
export function autoFreezeMissedDay(p: StudyProgress, todayKey: string): StudyProgress {
  const tokens = p.freezeTokens ?? 0;
  if (tokens <= 0) return p;
  const active = Object.keys(p.dailyCounts).filter(k => p.dailyCounts[k] > 0).map(dayNumber).sort((a, b) => a - b);
  if (active.length === 0) return p;

  const today = dayNumber(todayKey);
  const last = active[active.length - 1];
  if (last !== today - 2) return p; // not a single missed-yesterday gap

  const yesterdayKey = dayKeyFromNumber(today - 1);
  const frozen = p.frozenDays ?? [];
  if (frozen.includes(yesterdayKey)) return p;
  return { ...p, frozenDays: [...frozen, yesterdayKey], freezeTokens: tokens - 1 };
}

/** Refill freeze tokens to `max` once per ISO week (idempotent within the week). Pure. */
export function refreshFreezeTokens(p: StudyProgress, todayKey: string, max: number): StudyProgress {
  const wk = isoWeekKey(todayKey);
  if (p.freezeWeekKey === wk) return p;
  return { ...p, freezeTokens: max, freezeWeekKey: wk };
}

/** ISO-8601 week key (yyyy-Www), Monday-based. Pure. */
export function isoWeekKey(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Record one answered spot on `dayKey`, updating totals + streaks. Returns new progress. */
export function recordAnswer(p: StudyProgress, correct: boolean, dayKey: string): StudyProgress {
  const dailyCounts = { ...p.dailyCounts, [dayKey]: (p.dailyCounts[dayKey] ?? 0) + 1 };
  const { current, longest } = computeStreaksWithFreeze(dailyCounts, dayKey, p.frozenDays ?? []);
  return {
    ...p,
    totalAnswered: p.totalAnswered + 1,
    totalCorrect: p.totalCorrect + (correct ? 1 : 0),
    dailyCounts,
    lastStudyDate: dayKey,
    currentStreak: current,
    longestStreak: Math.max(p.longestStreak, longest),
  };
}

/**
 * Record one PRACTICE (Spot/Decision) answer: update totals + streaks AND consume one from today's shared
 * 'practiceQuestion' pool — composed into ONE new progress so a single context commit carries both mutations.
 * This is the fix for the double-commit clobber that made Decision Trainer bypass the cap: never split the
 * answer and the consume across two commits built from the same base. Both trainers call this → one pool. Pure.
 */
export function recordPracticeAnswer(p: StudyProgress, correct: boolean, dayKey: string): StudyProgress {
  const answered = recordAnswer(p, correct, dayKey);
  return {
    ...answered,
    dailyLimitCounters: consumeToday(dailyCountersOf(answered), 'practiceQuestion', dayKey),
  };
}

export interface StudyStats {
  accuracyPct: number | null;
  answeredToday: number;
  goalMetToday: boolean;
}

export function studyStats(p: StudyProgress, todayKey: string): StudyStats {
  const answeredToday = p.dailyCounts[todayKey] ?? 0;
  return {
    accuracyPct: p.totalAnswered > 0 ? (p.totalCorrect / p.totalAnswered) * 100 : null,
    answeredToday,
    goalMetToday: answeredToday >= p.dailyGoal,
  };
}

/** Record one completed quiz (lifetime counter; feeds XP). Pure. */
export function recordQuizCompleted(p: StudyProgress): StudyProgress {
  return { ...p, quizzesCompleted: (p.quizzesCompleted ?? 0) + 1 };
}

/**
 * Record one FINISHED quiz: bump the lifetime counter AND consume one 'quiz' unit from today's daily
 * limit — composed into ONE new progress so a single context commit carries both mutations. Same fix
 * class as recordPracticeAnswer: the shipped QuizRunner chained consumeLimit + recordQuizCompleted as
 * two commits and the second clobbered the first, so FREE_QUIZ_PER_DAY was never enforced. Pure.
 */
export function recordQuizFinished(p: StudyProgress, dayKey: string): StudyProgress {
  const done = recordQuizCompleted(p);
  return { ...done, dailyLimitCounters: consumeToday(dailyCountersOf(done), 'quiz', dayKey) };
}

/** Record one completed/read lesson (lifetime counter; feeds XP). Pure. */
export function recordLessonCompleted(p: StudyProgress): StudyProgress {
  return { ...p, lessonsCompleted: (p.lessonsCompleted ?? 0) + 1 };
}

/** Read the daily-limit counters, defaulting per-kind (v1 data and pre-practiceQuestion files). Pure. */
export function dailyCountersOf(p: StudyProgress): DailyLimitCounters {
  return { ...emptyDailyCounters(), ...(p.dailyLimitCounters ?? {}) };
}
