/** Blind structures + stored clock for local tournaments. Blinds are CHIP
 *  denominations (abstract tournament chips), not money — money lives in the
 *  prize pool. The clock is STORED state (pause/resume/manual level), not derived. */

import type { BlindLevel, BlindPreset, TournamentClock } from './types';

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

/** Build an editable blind structure from a preset. */
export function generateBlindLevels(preset: BlindPreset): BlindLevel[] {
  const durationSeconds = LEVEL_DURATION_SECONDS[preset];
  return BASE_BLINDS.map(([smallBlind, bigBlind]) => ({ smallBlind, bigBlind, durationSeconds }));
}

/** A fresh blank level (used by the structure editor when adding rows). */
export function nextBlindLevel(levels: BlindLevel[]): BlindLevel {
  const last = levels[levels.length - 1];
  if (!last) return { smallBlind: 25, bigBlind: 50, durationSeconds: 15 * 60 };
  return {
    smallBlind: last.smallBlind * 2,
    bigBlind: last.bigBlind * 2,
    ante: last.ante ? last.ante * 2 : undefined,
    durationSeconds: last.durationSeconds,
  };
}

/** Clamp an index to a defined level (stays on the last level past the end). */
export function levelAt(levels: BlindLevel[], index: number): BlindLevel {
  if (levels.length === 0) return { smallBlind: 0, bigBlind: 0, durationSeconds: 0 };
  return levels[Math.max(0, Math.min(index, levels.length - 1))];
}

// ---------------------------------------------------------------------------
// Stored clock — pure functions
// ---------------------------------------------------------------------------

export function initClock(levels: BlindLevel[], nowMs: number): TournamentClock {
  return {
    status: 'running',
    levelIndex: 0,
    lastResumeMs: nowMs,
    remainingMsAtResume: (levels[0]?.durationSeconds ?? 0) * 1000,
  };
}

/** Ms left in the current level right now. */
export function clockRemainingMs(clock: TournamentClock, nowMs: number): number {
  if (clock.status === 'paused') return Math.max(0, clock.remainingMsAtResume);
  return Math.max(0, clock.remainingMsAtResume - (nowMs - clock.lastResumeMs));
}

export function pauseClock(clock: TournamentClock, nowMs: number): TournamentClock {
  if (clock.status === 'paused') return clock;
  return { ...clock, status: 'paused', remainingMsAtResume: clockRemainingMs(clock, nowMs) };
}

export function resumeClock(clock: TournamentClock, nowMs: number): TournamentClock {
  if (clock.status === 'running') return clock;
  return { ...clock, status: 'running', lastResumeMs: nowMs };
}

/** Jump to a specific level (clamped); restarts that level's timer, keeps run/pause status. */
export function gotoLevel(
  clock: TournamentClock,
  levels: BlindLevel[],
  index: number,
  nowMs: number,
): TournamentClock {
  const levelIndex = Math.max(0, Math.min(index, levels.length - 1));
  return {
    ...clock,
    levelIndex,
    lastResumeMs: nowMs,
    remainingMsAtResume: (levels[levelIndex]?.durationSeconds ?? 0) * 1000,
  };
}

/** Advance to the next level when a running level hits zero (stays on the last level). */
export function tickAutoAdvance(
  clock: TournamentClock,
  levels: BlindLevel[],
  nowMs: number,
): TournamentClock {
  if (clock.status !== 'running') return clock;
  if (clockRemainingMs(clock, nowMs) > 0) return clock;
  if (clock.levelIndex >= levels.length - 1) return clock;
  return gotoLevel(clock, levels, clock.levelIndex + 1, nowMs);
}

export interface ClockView {
  current: BlindLevel;
  next?: BlindLevel;
  /** 1-based level number for display. */
  levelNumber: number;
  secondsRemaining: number;
  paused: boolean;
}

export function clockView(clock: TournamentClock, levels: BlindLevel[], nowMs: number): ClockView {
  const current = levelAt(levels, clock.levelIndex);
  const next = clock.levelIndex + 1 < levels.length ? levels[clock.levelIndex + 1] : undefined;
  return {
    current,
    next,
    levelNumber: clock.levelIndex + 1,
    secondsRemaining: Math.ceil(clockRemainingMs(clock, nowMs) / 1000),
    paused: clock.status === 'paused',
  };
}
