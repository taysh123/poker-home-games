/** XP + rank math — pure, testable. XP is DERIVED from local signals; ranks are cosmetic. */
import type { EngagementSignals } from '../types';

export const XP_WEIGHTS = {
  spot: 2,
  bankrollSession: 10,
  localGame: 15,
  coachAnalysis: 20,
  streakDay: 5,
  achievement: 25,
  quizCompleted: 8,
  lessonCompleted: 6,
} as const;

export function computeXp(s: EngagementSignals, achievementsUnlocked: number): number {
  return (
    s.spotsAnswered * XP_WEIGHTS.spot +
    s.bankrollSessions * XP_WEIGHTS.bankrollSession +
    s.localGamesFinished * XP_WEIGHTS.localGame +
    s.coachAnalyses * XP_WEIGHTS.coachAnalysis +
    s.studyStreak * XP_WEIGHTS.streakDay +
    s.quizzesCompleted * XP_WEIGHTS.quizCompleted +
    s.lessonsCompleted * XP_WEIGHTS.lessonCompleted +
    Math.max(0, achievementsUnlocked) * XP_WEIGHTS.achievement
  );
}

export interface Rank { name: string; min: number }

/** Poker-themed cosmetic ranks. Thresholds tunable. */
export const RANKS: Rank[] = [
  { name: 'Rounder', min: 0 },
  { name: 'Reg', min: 250 },
  { name: 'Grinder', min: 750 },
  { name: 'Crusher', min: 2000 },
  { name: 'Shark', min: 5000 },
  { name: 'Legend', min: 12000 },
];

export interface RankInfo {
  rank: Rank;
  next: Rank | null;
  /** 0..1 progress toward the next rank (1 at max rank). */
  progressPct: number;
  index: number;
}

export function rankForXp(xp: number): RankInfo {
  let index = 0;
  for (let k = 0; k < RANKS.length; k++) if (xp >= RANKS[k].min) index = k;
  const rank = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  const progressPct = next ? Math.min(1, Math.max(0, (xp - rank.min) / (next.min - rank.min))) : 1;
  return { rank, next, progressPct, index };
}
