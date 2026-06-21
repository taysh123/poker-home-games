/**
 * Mastery aggregation tests (Phase B5) — pure. applyAttempt accumulation, engine mapping, totals.
 */
import { applyAttempt, masteryByKey, totalAttempts } from '../aggregate';
import type { ObjectiveStat } from '../../types';

const NOW = new Date('2026-06-21T12:00:00.000Z').getTime();

describe('applyAttempt', () => {
  it('initializes from undefined and counts correctness', () => {
    expect(applyAttempt(undefined, true, NOW)).toEqual({ attempts: 1, correct: 1, lastActivityTs: NOW });
    expect(applyAttempt(undefined, false, NOW)).toEqual({ attempts: 1, correct: 0, lastActivityTs: NOW });
  });
  it('accumulates immutably and advances lastActivityTs', () => {
    const a: ObjectiveStat = { attempts: 2, correct: 1, lastActivityTs: NOW - 1000 };
    const b = applyAttempt(a, true, NOW);
    expect(b).toEqual({ attempts: 3, correct: 2, lastActivityTs: NOW });
    expect(a.attempts).toBe(2); // original untouched
  });
});

describe('masteryByKey — maps materialized stats through the engine', () => {
  it('classifies per the engine thresholds (recent activity → no decay)', () => {
    const stats: Record<string, ObjectiveStat> = {
      mastered:   { attempts: 20, correct: 18, lastActivityTs: NOW }, // 90% ≥20 → Mastered
      proficient: { attempts: 10, correct: 8,  lastActivityTs: NOW }, // 80% ≥10 → Proficient
      learning:   { attempts: 5,  correct: 2,  lastActivityTs: NOW }, // ≥3, low acc → Learning
      novice:     { attempts: 1,  correct: 1,  lastActivityTs: NOW }, // <3 → Novice
    };
    expect(masteryByKey(stats, NOW)).toEqual({
      mastered: 'Mastered', proficient: 'Proficient', learning: 'Learning', novice: 'Novice',
    });
  });
  it('applies inactivity decay (>30 days) one level down', () => {
    const stale = { mastered: { attempts: 20, correct: 18, lastActivityTs: NOW - 40 * 86_400_000 } };
    expect(masteryByKey(stale, NOW).mastered).toBe('Proficient');
  });
  it('empty in → empty out', () => {
    expect(masteryByKey({}, NOW)).toEqual({});
  });
});

describe('totalAttempts', () => {
  it('sums attempts across objectives', () => {
    expect(totalAttempts({ a: { attempts: 3, correct: 1 }, b: { attempts: 5, correct: 4 } })).toBe(8);
    expect(totalAttempts({})).toBe(0);
  });
});
