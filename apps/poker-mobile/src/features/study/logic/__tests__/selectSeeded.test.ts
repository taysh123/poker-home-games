/**
 * selectSeeded (slice 1.3) — skill-seeded difficulty with a pool-size fallback. The bank's
 * Difficulty filter is an EXACT string match; seeding must never silently shrink the daily
 * rotation below a full run (exploration gotcha), so the filter applies only when the filtered
 * pool still holds at least `minPool` questions.
 */
import { selectSeeded, type QuizQuestion } from '../quiz';

const q = (id: string, difficulty: string, free = true): QuizQuestion => ({
  id, category: 'RFI', topic: 't', difficulty, prompt: 'p?',
  options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }],
  correct: 'A', explanation: 'e', free,
});

const pool = [
  ...Array.from({ length: 12 }, (_, i) => q(`b${i}`, 'Beginner')),
  ...Array.from({ length: 12 }, (_, i) => q(`i${i}`, 'Intermediate')),
  ...Array.from({ length: 4 }, (_, i) => q(`a${i}`, 'Advanced')),
];

describe('selectSeeded', () => {
  it('applies the seeded difficulty when the filtered pool covers a full run', () => {
    const out = selectSeeded(pool, {}, 'Intermediate', 10);
    expect(out.length).toBe(12);
    expect(out.every(x => x.difficulty === 'Intermediate')).toBe(true);
  });

  it('falls back to the unfiltered selection when seeding would starve the run', () => {
    const out = selectSeeded(pool, {}, 'Advanced', 10); // only 4 Advanced — not a full run
    expect(out.length).toBe(pool.length);
  });

  it('no seed ⇒ identical to the plain selection', () => {
    const out = selectSeeded(pool, {}, null, 10);
    expect(out.length).toBe(pool.length);
  });

  it('composes with the base filter (freeOnly/category run first, then the seed check)', () => {
    const mixed = [...pool, q('p1', 'Intermediate', false)];
    const out = selectSeeded(mixed, { freeOnly: true }, 'Intermediate', 10);
    expect(out.some(x => !x.free)).toBe(false);
    expect(out.every(x => x.difficulty === 'Intermediate')).toBe(true);
  });

  it('an unknown difficulty string (catalog drift) falls back instead of emptying the pool', () => {
    const out = selectSeeded(pool, {}, 'Expert', 10);
    expect(out.length).toBe(pool.length);
  });
});
