/**
 * "Next game plan" (slice 2.4) — a lightweight, on-device plan a group leaves themselves when a game
 * ends ("Same crew next week?"). Guests AND signed-in users share the same purely local model — no
 * server infra. At most one plan exists at a time (like the at-most-one-active-local-game invariant).
 *
 * This module is PURE data + queries; persistence lives in `data/nextGamePlanStore.ts` and the plan is
 * exposed via `context/NextGamePlanContext`. Honesty/scope: `crew` is display names only (no ids,
 * no amounts). `gameDay`/`createdDayKey` are LOCAL day keys (`features/study/logic/localDay#localDayKey`) —
 * never the UTC day-key shortcut that `dayKeyBan.test.ts` forbids. Day keys compare lexicographically (YYYY-MM-DD).
 */
export type GameMode = 'cash' | 'tournament';

export interface NextGamePlan {
  mode: GameMode;
  /** Player display names carried over from the finished game. */
  crew: string[];
  /** Local day key (YYYY-MM-DD) the game is planned for; undefined = no specific day set yet. */
  gameDay?: string;
  /** Local day key the plan was created on. */
  createdDayKey: string;
}

/** Compact crew line for the "Next game" card: up to `max` names, then "+N" for the rest. */
export function crewSummary(crew: string[], max = 3): string {
  if (crew.length === 0) return '';
  if (crew.length <= max) return crew.join(', ');
  return `${crew.slice(0, max).join(', ')} +${crew.length - max}`;
}

/** True when a dated plan lands on `todayKey` — drives the game-day CTA + notification. */
export function isGameDay(plan: NextGamePlan, todayKey: string): boolean {
  return plan.gameDay != null && plan.gameDay === todayKey;
}

/** True once a dated plan's game day has passed — the caller auto-clears stale plans. Undated plans
 * never expire by date (they persist until the game is started or the plan is dismissed). */
export function isPlanStale(plan: NextGamePlan, todayKey: string): boolean {
  return plan.gameDay != null && plan.gameDay < todayKey;
}
