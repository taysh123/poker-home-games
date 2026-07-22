/**
 * Placement drill logic (slice 1.4) — PURE. Five questions spread across the bank's difficulty
 * bands, a forgiving score→skill mapping, and the result copy. The selection must ALWAYS return
 * a full run when the pool allows (thin bands backfill) and must never repeat a question.
 */
import {
  PLACEMENT_SIZE,
  PLACEMENT_SPREAD,
  placementQuestions,
  skillFromPlacement,
  placementLevelCopy,
} from '../placement';
import type { QuizQuestion } from '../../../study/logic/quiz';

const q = (id: string, difficulty: string): QuizQuestion => ({
  id, category: 'RFI', topic: 't', difficulty, prompt: `p-${id}?`,
  options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }],
  correct: 'A', explanation: 'e', free: true,
});

const band = (prefix: string, difficulty: string, n: number) =>
  Array.from({ length: n }, (_, i) => q(`${prefix}${i}`, difficulty));

const fullPool = [
  ...band('b', 'Beginner', 20),
  ...band('i', 'Intermediate', 20),
  ...band('a', 'Advanced', 20),
];

const DAY = '2026-07-22';

describe('placementQuestions', () => {
  it('returns exactly PLACEMENT_SIZE questions from a healthy pool', () => {
    expect(placementQuestions(fullPool, DAY)).toHaveLength(PLACEMENT_SIZE);
  });

  it('honors the difficulty spread (2 Beginner / 2 Intermediate / 1 Advanced)', () => {
    const run = placementQuestions(fullPool, DAY);
    for (const [difficulty, count] of PLACEMENT_SPREAD) {
      expect(run.filter(x => x.difficulty === difficulty)).toHaveLength(count);
    }
  });

  it('is deterministic for a given day and varies across days', () => {
    expect(placementQuestions(fullPool, DAY)).toEqual(placementQuestions(fullPool, DAY));
    const other = placementQuestions(fullPool, '2026-07-23');
    expect(other.map(x => x.id)).not.toEqual(placementQuestions(fullPool, DAY).map(x => x.id));
  });

  it('never repeats a question', () => {
    const run = placementQuestions(fullPool, DAY);
    expect(new Set(run.map(x => x.id)).size).toBe(run.length);
  });

  it('backfills from other bands when one is thin — still a full run', () => {
    const thin = [...band('b', 'Beginner', 20), ...band('a', 'Advanced', 1)]; // no Intermediate
    const run = placementQuestions(thin, DAY);
    expect(run).toHaveLength(PLACEMENT_SIZE);
    expect(new Set(run.map(x => x.id)).size).toBe(PLACEMENT_SIZE);
  });

  it('a pool smaller than a full run returns the whole pool (no padding, no crash)', () => {
    const tiny = band('b', 'Beginner', 3);
    expect(placementQuestions(tiny, DAY)).toHaveLength(3);
    expect(placementQuestions([], DAY)).toEqual([]);
  });

  it('does not mutate the pool', () => {
    const copy = fullPool.map(x => ({ ...x }));
    placementQuestions(fullPool, DAY);
    expect(fullPool).toEqual(copy);
  });
});

describe('skillFromPlacement — forgiving bands (guessing ≈ 1.25 correct ⇒ "new")', () => {
  it.each([
    [0, 'new'], [1, 'new'],
    [2, 'solid'], [3, 'solid'],
    [4, 'grinder'], [5, 'grinder'],
  ] as const)('%i correct ⇒ %s', (correct, expected) => {
    expect(skillFromPlacement(correct)).toBe(expected);
  });

  it('clamps nonsense inputs instead of throwing', () => {
    expect(skillFromPlacement(-3)).toBe('new');
    expect(skillFromPlacement(99)).toBe('grinder');
  });
});

describe('placementLevelCopy — honest, never score-shaming', () => {
  it.each(['new', 'solid', 'grinder'] as const)('%s has a title and an encouraging body', skill => {
    const copy = placementLevelCopy(skill);
    expect(copy.title.length).toBeGreaterThan(0);
    expect(copy.body.length).toBeGreaterThan(0);
    expect(`${copy.title} ${copy.body}`).not.toMatch(/\b(bad|poor|weak|fail)\b/i);
  });
});
