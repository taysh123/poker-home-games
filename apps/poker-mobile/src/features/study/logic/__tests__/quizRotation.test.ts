/**
 * Daily quiz rotation — the habit-loop fix. The shipped selectQuestions() is deterministic
 * first-N in source order, so a free user saw the SAME 10 questions every single day.
 *
 * dailyRotation(items, dayKey, count): ONE stable shuffle of the pool (seeded, day-independent)
 * + a window that advances by `count` each local day — fresh questions daily, identical within a
 * day (restarts/re-mounts see the same run), and every question appears before any repeats
 * (full cycle = pool/count days). Pure: the caller passes dayKey (localDayKey()); no Date.now.
 */
import { dailyRotation } from '../quizRotation';

const pool = (n: number): string[] => Array.from({ length: n }, (_, i) => `q${i}`);
const dayAfter = (key: string, days: number): string => {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const DAY = '2026-07-22';

describe('dailyRotation', () => {
  it('is deterministic for the same pool + day + count', () => {
    const items = pool(100);
    expect(dailyRotation(items, DAY, 10)).toEqual(dailyRotation(items, DAY, 10));
  });

  it('returns a different selection on consecutive days', () => {
    const items = pool(100);
    const today = dailyRotation(items, DAY, 10);
    const tomorrow = dailyRotation(items, dayAfter(DAY, 1), 10);
    expect(tomorrow).not.toEqual(today);
    // consecutive-day windows over the same shuffled order never overlap mid-cycle
    expect(tomorrow.filter(q => today.includes(q))).toHaveLength(0);
  });

  it('covers the whole pool with no repeats across a full cycle (divisible pool)', () => {
    const items = pool(50);
    const seen = new Set<string>();
    for (let d = 0; d < 5; d++) {
      for (const q of dailyRotation(items, dayAfter(DAY, d), 10)) {
        expect(seen.has(q)).toBe(false); // no repeat until the pool cycles
        seen.add(q);
      }
    }
    expect(seen.size).toBe(50);
  });

  it('covers the whole pool within a ceil-cycle for non-divisible pools (no within-day dupes)', () => {
    const items = pool(23);
    const seen = new Set<string>();
    for (let d = 0; d < Math.ceil(23 / 10); d++) {
      const run = dailyRotation(items, dayAfter(DAY, d), 10);
      expect(new Set(run).size).toBe(run.length); // never a duplicate inside one day's run
      run.forEach(q => seen.add(q));
    }
    expect(seen.size).toBe(23);
  });

  it('actually shuffles — a day\'s window is not simply source order', () => {
    const items = pool(200);
    const run = dailyRotation(items, DAY, 20);
    expect(run).not.toEqual(items.slice(0, 20));
  });

  it('returns the whole pool (each item once) when count >= pool size', () => {
    const items = pool(7);
    const run = dailyRotation(items, DAY, 10);
    expect(run).toHaveLength(7);
    expect(new Set(run).size).toBe(7);
  });

  it('handles empty pools and non-positive counts', () => {
    expect(dailyRotation([], DAY, 10)).toEqual([]);
    expect(dailyRotation(pool(5), DAY, 0)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const items = pool(30);
    const copy = [...items];
    dailyRotation(items, DAY, 10);
    expect(items).toEqual(copy);
  });
});
