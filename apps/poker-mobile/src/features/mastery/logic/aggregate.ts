/**
 * Mastery aggregation (pure, tested). Turns recorded attempts into the `ObjectiveStat` shape the mastery
 * engine (logic/mastery.ts) consumes, and maps materialized stats through the engine to per-key states.
 * No I/O, no React. Never invents data — a key only exists once a real attempt has been recorded for it.
 */
import { objectiveMastery } from './mastery';
import type { ObjectiveStat, ObjectiveMastery } from '../types';

/** Apply one graded attempt to an objective's running stat (immutable). */
export function applyAttempt(stat: ObjectiveStat | undefined, correct: boolean, at: number): ObjectiveStat {
  return {
    attempts: (stat?.attempts ?? 0) + 1,
    correct: (stat?.correct ?? 0) + (correct ? 1 : 0),
    lastActivityTs: at,
  };
}

/** Map materialized per-key stats through the engine to per-key mastery states (with inactivity decay). */
export function masteryByKey(
  statsByKey: Record<string, ObjectiveStat>,
  now: number = Date.now(),
): Record<string, ObjectiveMastery> {
  const out: Record<string, ObjectiveMastery> = {};
  for (const key of Object.keys(statsByKey)) {
    out[key] = objectiveMastery(statsByKey[key], now);
  }
  return out;
}

/** Total attempts across all objectives (for honest "based on N attempts" copy). */
export function totalAttempts(statsByKey: Record<string, ObjectiveStat>): number {
  return Object.values(statsByKey).reduce((n, s) => n + s.attempts, 0);
}
