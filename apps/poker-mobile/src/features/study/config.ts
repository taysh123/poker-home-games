// apps/poker-mobile/src/features/study/config.ts
/**
 * Free training-taste limits — the SINGLE source of tunable free-rep knobs (Phase 1).
 * These meter FREE interactive content, NOT revenue: enforced client-side, reset on a new
 * local day, and bypassed entirely for premium (see logic/dailyLimits.ts). Lessons in free
 * packs are UNMETERED — only quizzes and Spot Trainer sessions are limited.
 */

/** Free multiple-choice quizzes a non-premium user may complete per local day. */
export const FREE_QUIZ_PER_DAY = 1;

/** Free Spot Trainer sessions a non-premium user may start per local day. */
export const FREE_TRAINER_SESSIONS_PER_DAY = 3;

/** Counter kinds tracked for daily limits. Keep in sync with StudyProgress.dailyLimitCounters. */
export type DailyLimitKind = 'quiz' | 'trainerSession';

/** Free per-day cap for each metered activity. Premium bypasses (Infinity). */
export const FREE_DAILY_LIMITS: Record<DailyLimitKind, number> = {
  quiz: FREE_QUIZ_PER_DAY,
  trainerSession: FREE_TRAINER_SESSIONS_PER_DAY,
};
