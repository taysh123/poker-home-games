// apps/poker-mobile/src/features/study/config.ts
/**
 * Free training-taste limits — the SINGLE source of tunable free-rep knobs (Phase 1).
 * These meter FREE interactive content, NOT revenue: enforced client-side, reset on a new
 * local day, and bypassed entirely for premium (see logic/dailyLimits.ts). Lessons in free
 * packs are UNMETERED — only quizzes and Spot Trainer sessions are limited.
 */

/** Free practice questions (Spot + Decision trainer, SHARED pool) per local day. THE tunable knob. */
export const FREE_PRACTICE_QUESTIONS_PER_DAY = 10;

/** Free multiple-choice quizzes a non-premium user may complete per local day. */
export const FREE_QUIZ_PER_DAY = 1;

/** Retired (free-first): trainer SESSIONS are no longer metered — questions are. Key retained for stored-file compat. */
export const FREE_TRAINER_SESSIONS_PER_DAY = 3;

/** Counter kinds tracked for daily limits. Keep in sync with StudyProgress.dailyLimitCounters. */
export type DailyLimitKind = 'quiz' | 'trainerSession' | 'practiceQuestion';

/** Free per-day cap for each metered activity. Premium bypasses (Infinity). */
export const FREE_DAILY_LIMITS: Record<DailyLimitKind, number> = {
  quiz: FREE_QUIZ_PER_DAY,
  trainerSession: FREE_TRAINER_SESSIONS_PER_DAY,
  practiceQuestion: FREE_PRACTICE_QUESTIONS_PER_DAY,
};

/**
 * Free-first launch: the 3 starter lessons open to everyone (the zero-prerequisite beginner set —
 * cash / tournament / mindset). Every other module renders locked ("Coming soon" while the paywall
 * flag is OFF). This list OVERRIDES the workbook's FreeOrPremium column — single tuning point.
 */
export const FREE_LESSON_MODULE_IDS = ['LM-01', 'LM-05', 'LM-04'];
