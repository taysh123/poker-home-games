/**
 * Persona → surface recommendations (slice 1.3) — PURE. Small total functions the screens
 * consume: hero variant by goal, Study training order by format, quiz difficulty by skill.
 * Every fn treats null (no persona / skipped quiz) as "current default behavior".
 */
import type { PersonaGoal, PersonaSkill, PersonaFormat } from '../types';

export type HeroVariant = 'host' | 'improver';

/** Improvers lead with the drill; hosts, both, and the un-personalized lead with the game. */
export function heroVariantForGoal(goal: PersonaGoal | null | undefined): HeroVariant {
  return goal === 'improve' ? 'improver' : 'host';
}

/** StudyScreen's TRAIN cards, in their current (cash-first) order. */
export const TRAIN_KEYS = ['spot', 'decision', 'lessons', 'quizzes', 'packs'] as const;
export type TrainKey = (typeof TRAIN_KEYS)[number];

/** Tournament players see Quizzes first (the bank's ICM/push-fold depth lives there). */
export function trainOrderForFormat(format: PersonaFormat | null | undefined): readonly TrainKey[] {
  if (format !== 'tournament') return TRAIN_KEYS;
  return ['quizzes', ...TRAIN_KEYS.filter(k => k !== 'quizzes')] as TrainKey[];
}

/**
 * Drill-card sub-line, honest against the SHARED daily practice pool (never overpromise):
 * full pool ⇒ the ten-questions promise; partial ⇒ the real remaining count; spent ⇒ null
 * (callers HIDE the card — no dead-end tap into a limit nudge); Infinity ⇒ unlimited copy.
 */
export function drillCardSub(remaining: number): string | null {
  if (remaining === Infinity) return 'Unlimited practice — build your edge';
  if (remaining <= 0) return null;
  if (remaining >= 10) return 'Ten free questions — build your edge';
  return `${remaining} free question${remaining === 1 ? '' : 's'} left today`;
}

/**
 * The bank's EXACT Difficulty strings (708 Beginner / 445 Intermediate / 307 Advanced rows) —
 * selectQuestions matches them verbatim, so any drift here silently empties the pool
 * (selectSeeded's fallback guards the run regardless).
 */
export function difficultyForSkill(skill: PersonaSkill | null | undefined): string | null {
  switch (skill) {
    case 'new': return 'Beginner';
    case 'solid': return 'Intermediate';
    case 'grinder': return 'Advanced';
    default: return null;
  }
}
