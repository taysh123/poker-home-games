/**
 * Persona → surface recommendations (slice 1.3) — PURE. The hero variant, the Study training
 * order, and the quiz difficulty seed. Difficulty strings must EXACTLY match the bank's
 * Difficulty column (Beginner/Intermediate/Advanced) — a mismatch silently empties the pool.
 */
import { heroVariantForGoal, trainOrderForFormat, difficultyForSkill, TRAIN_KEYS } from '../recommendations';

describe('heroVariantForGoal', () => {
  it('improvers get the drill-first hero; hosts, both, and the un-personalized get the game hero', () => {
    expect(heroVariantForGoal('improve')).toBe('improver');
    expect(heroVariantForGoal('host')).toBe('host');
    expect(heroVariantForGoal('both')).toBe('host'); // game night stays the core
    expect(heroVariantForGoal(null)).toBe('host');   // pre-persona default = current behavior
  });
});

describe('trainOrderForFormat', () => {
  it('tournament players see Quizzes (the ICM/push-fold bank) first', () => {
    expect(trainOrderForFormat('tournament')[0]).toBe('quizzes');
  });

  it('cash, both, and null keep the current order (Spot Trainer first)', () => {
    for (const f of ['cash', 'both', null] as const) {
      expect(trainOrderForFormat(f)).toEqual(TRAIN_KEYS);
    }
  });

  it('always returns a complete, duplicate-free ordering of all five keys', () => {
    for (const f of ['cash', 'tournament', 'both', null] as const) {
      const order = trainOrderForFormat(f);
      expect([...order].sort()).toEqual([...TRAIN_KEYS].sort());
      expect(new Set(order).size).toBe(TRAIN_KEYS.length);
    }
  });
});

describe('difficultyForSkill', () => {
  it('maps skills to the bank\'s EXACT difficulty strings', () => {
    expect(difficultyForSkill('new')).toBe('Beginner');
    expect(difficultyForSkill('solid')).toBe('Intermediate');
    expect(difficultyForSkill('grinder')).toBe('Advanced');
  });

  it('no skill ⇒ no filter', () => {
    expect(difficultyForSkill(null)).toBeNull();
  });
});
