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
  /** Which flow made the plan — routes the "start" action (server session flow vs local wizard).
   * Absent on older payloads; treat as 'local'. */
  origin?: 'local' | 'server';
}

/** Compact crew line for the "Next game" card: up to `max` names, then "+N" for the rest. */
export function crewSummary(crew: string[], max = 3): string {
  if (crew.length === 0) return '';
  if (crew.length <= max) return crew.join(', ');
  return `${crew.slice(0, max).join(', ')} +${crew.length - max}`;
}

/** Human label for the planned day: "Tonight" on the day itself, "Sat, Aug 1" for a future day,
 * '' when undated. Parses the day key by LOCAL components — `new Date('YYYY-MM-DD')` is UTC
 * midnight and would render the previous day in negative-offset timezones. */
export function gameDayLabel(gameDay: string | undefined, todayKey: string): string {
  if (!gameDay) return '';
  if (gameDay === todayKey) return 'Tonight';
  const [y, m, d] = gameDay.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Same crew next week?" sub-line — platform-honest: the game-day nudge is a NATIVE local
 * notification; web has none, so web copy points at the Home card instead of promising a nudge. */
export function planNudgeLine(crewLine: string, isWeb: boolean): string {
  return isWeb
    ? `We'll line up ${crewLine} — your next game will be waiting on Home.`
    : `We'll line up ${crewLine} and nudge you on game day.`;
}

/** Post-plan success toast — same platform-honesty rule as `planNudgeLine`. */
export function planToastText(isWeb: boolean): string {
  return isWeb
    ? 'Next game planned — find it on your Home screen.'
    : "Next game planned — we'll nudge you on game day.";
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

/** True from the plan's game day ONWARD — the game has (presumably) happened, so end-game screens
 * re-offer "Same crew next week?" instead of showing the spent plan as still upcoming. This is what
 * keeps the loop closing week over week (a Friday game can immediately plan next Friday). */
export function isPlanConsumed(plan: NextGamePlan, todayKey: string): boolean {
  return plan.gameDay != null && plan.gameDay <= todayKey;
}
