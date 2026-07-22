/**
 * Placement drill (slice 1.4) — PURE. Five questions spread across the bank's difficulty bands
 * that calibrate `persona.skill`. Assessment, not practice: the screen shows no answers and no
 * explanations, which is what makes it fair to leave unmetered (and it is strictly one-time).
 * Day-seeded via the same deterministic rotation the daily quiz uses — no Date.now here.
 */
import { dailyRotation } from '../../study/logic/quizRotation';
import type { QuizQuestion } from '../../study/logic/quiz';
import type { PersonaSkill } from '../types';

/** Questions in one placement run. */
export const PLACEMENT_SIZE = 5;

/** Difficulty mix — the bank's EXACT band strings (see recommendations.difficultyForSkill). */
export const PLACEMENT_SPREAD: readonly (readonly [string, number])[] = [
  ['Beginner', 2],
  ['Intermediate', 2],
  ['Advanced', 1],
];

/**
 * Pick the run: a day-seeded slice of each band, then backfill from whatever remains so a thin
 * band never shortens the run. A pool smaller than a full run is returned whole (never padded).
 */
export function placementQuestions(pool: QuizQuestion[], dayKey: string): QuizQuestion[] {
  if (pool.length <= PLACEMENT_SIZE) return [...pool];

  const picked: QuizQuestion[] = [];
  const used = new Set<string>();

  for (const [difficulty, count] of PLACEMENT_SPREAD) {
    const band = pool.filter(q => q.difficulty === difficulty && !used.has(q.id));
    for (const q of dailyRotation(band, dayKey, count)) {
      picked.push(q);
      used.add(q.id);
    }
  }

  if (picked.length < PLACEMENT_SIZE) {
    const rest = pool.filter(q => !used.has(q.id));
    for (const q of dailyRotation(rest, dayKey, PLACEMENT_SIZE - picked.length)) {
      picked.push(q);
      used.add(q.id);
    }
  }

  return picked.slice(0, PLACEMENT_SIZE);
}

/**
 * Score → level. Deliberately forgiving: random guessing over 4 options averages ~1.25 correct,
 * which must land in 'new' rather than flattering the user into a level they'll struggle at.
 */
export function skillFromPlacement(correct: number): PersonaSkill {
  const c = Math.max(0, Math.min(PLACEMENT_SIZE, Math.round(correct)));
  if (c <= 1) return 'new';
  if (c <= 3) return 'solid';
  return 'grinder';
}

/** Result copy — encouraging at every level; a low score is a starting point, never a verdict. */
export function placementLevelCopy(skill: PersonaSkill): { title: string; body: string } {
  switch (skill) {
    case 'new':
      return {
        title: 'Starting with the fundamentals',
        body: 'We’ll lead with the core spots — opening ranges, position, and the math that pays for itself.',
      };
    case 'solid':
      return {
        title: 'You hold your own',
        body: 'Solid base. Your drills will lean into the spots that separate winning regs from break-even ones.',
      };
    case 'grinder':
      return {
        title: 'Sharp already',
        body: 'Strong read on the fundamentals. We’ll push you toward the tougher, higher-variance decisions.',
      };
  }
}
