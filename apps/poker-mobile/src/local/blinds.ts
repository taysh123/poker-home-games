/** Blind structures for local tournaments. Blinds are CHIP denominations
 *  (abstract tournament chips), not money — money lives in the prize pool. */

import type { BlindPreset } from './types';

export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  /** Seconds this level lasts. */
  durationSeconds: number;
}

const BASE_BLINDS: Array<[number, number]> = [
  [25, 50], [50, 100], [75, 150], [100, 200], [150, 300],
  [200, 400], [300, 600], [400, 800], [600, 1200], [800, 1600],
  [1000, 2000], [1500, 3000],
];

const LEVEL_DURATION_SECONDS: Record<BlindPreset, number> = {
  turbo: 8 * 60,
  standard: 15 * 60,
  deep: 20 * 60,
};

export const BLIND_PRESET_LABELS: Record<BlindPreset, string> = {
  turbo: 'Turbo · 8 min levels',
  standard: 'Standard · 15 min levels',
  deep: 'Deep · 20 min levels',
};

/** Level for a given index (0-based); doubles beyond the base table. */
export function blindLevelAt(preset: BlindPreset, index: number): BlindLevel {
  const duration = LEVEL_DURATION_SECONDS[preset];
  if (index < BASE_BLINDS.length) {
    const [sb, bb] = BASE_BLINDS[index];
    return { level: index + 1, smallBlind: sb, bigBlind: bb, durationSeconds: duration };
  }
  const doublings = index - BASE_BLINDS.length + 1;
  const [lastSb, lastBb] = BASE_BLINDS[BASE_BLINDS.length - 1];
  return {
    level: index + 1,
    smallBlind: lastSb * 2 ** doublings,
    bigBlind: lastBb * 2 ** doublings,
    durationSeconds: duration,
  };
}

export interface BlindClock {
  current: BlindLevel;
  next: BlindLevel;
  /** Seconds until the next level starts. */
  secondsRemaining: number;
}

/** Deterministic clock derived from the tournament start time — no stored timer state. */
export function blindClock(preset: BlindPreset, startedAtIso: string, nowMs: number): BlindClock {
  const duration = LEVEL_DURATION_SECONDS[preset];
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - new Date(startedAtIso).getTime()) / 1000));
  const index = Math.floor(elapsedSeconds / duration);
  return {
    current: blindLevelAt(preset, index),
    next: blindLevelAt(preset, index + 1),
    secondsRemaining: duration - (elapsedSeconds % duration),
  };
}
