/**
 * Study progress + streak logic — pure, testable (functions take an explicit "today"
 * so date math is deterministic). Drives daily habit formation: streaks, daily goal,
 * accuracy.
 */
import { STUDY_SCHEMA_VERSION, type StudyProgress } from '../types';

export const DEFAULT_DAILY_GOAL = 10;

export function emptyProgress(dailyGoal = DEFAULT_DAILY_GOAL): StudyProgress {
  return {
    schemaVersion: STUDY_SCHEMA_VERSION,
    totalAnswered: 0,
    totalCorrect: 0,
    dailyGoal,
    dailyCounts: {},
    currentStreak: 0,
    longestStreak: 0,
  };
}

const MS_PER_DAY = 86400000;
const dayNumber = (key: string) => Math.floor(new Date(`${key}T00:00:00.000Z`).getTime() / MS_PER_DAY);

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

/** Record one answered spot on `dayKey`, updating totals + streaks. Returns new progress. */
export function recordAnswer(p: StudyProgress, correct: boolean, dayKey: string): StudyProgress {
  const dailyCounts = { ...p.dailyCounts, [dayKey]: (p.dailyCounts[dayKey] ?? 0) + 1 };
  const { current, longest } = computeStreaks(dailyCounts, dayKey);
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
