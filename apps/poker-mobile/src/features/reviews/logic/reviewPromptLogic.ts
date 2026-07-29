/**
 * Review-prompt rules — PURE. Zero imports, `nowMs` injected, no I/O, no React.
 *
 * Consumed by features/reviews/state/ReviewPromptContext.tsx. Everything hard to verify by hand
 * lives here so it can be verified by test instead: iOS caps the native dialog at ~3 prompts/year
 * and may silently no-op, so we can never confirm our own rate limiting by observation.
 *
 * STATUS (2026-07-29): this module is the reviewed CORE only. **Nothing calls it yet** — no screen
 * records a moment and no code path calls `requestReview`. The firing logic (when to ask, and how
 * to guarantee the ask lands at a genuinely terminal moment) is deferred to **Q1.4b**, which owns
 * the `reviews` flag flip. Three adversarial fleet rounds found the same defect class in three
 * different firing designs — an ill-timed OS dialog — so the presentation side gets its own design
 * pass rather than a fourth patch. Findings carried forward:
 * docs/superpowers/specs/2026-07-29-review-prompts-q1-4b-design.md.
 *
 * DESIGN NOTE (2026-07-29): there is NO sentiment sheet. Master-plan decision 4a (a pre-prompt
 * asking "Enjoying T Poker?", routing happy users to the store and unhappy users to email) was
 * SUPERSEDED by the owner after the Q1.4 critic fleet. The qualifying moments below ARE the
 * sentiment filter — a user who drilled at >=70%, finished a game, and holds a study streak has
 * selected themselves behaviourally, which is a more reliable signal than asking. Dropping the
 * sheet also deleted an occlusion-geometry subsystem that produced two blockers (including the
 * sheet rising over a LIVE game) and removed App Store Guideline 1.1.7 exposure, since
 * outcome-asymmetric routing is the canonical review-gating pattern Apple names as a rejection
 * cause. Full reasoning: docs/superpowers/specs/2026-07-28-review-prompts-design.md §0.
 *
 * HONESTY CONSTRAINTS (pinned in __tests__/reviewPromptLogic.test.ts):
 *  - The three moment kinds below are the complete PRODUCIBLE set — each has a real call site. A
 *    fourth ('achievement_dismissed') was declared in an earlier draft and produced nowhere; the
 *    vocabulary now matches what actually ships rather than what was planned.
 *  - `ReviewSignals` carries no win/loss streak field, and `Record<keyof ReviewSignals, true>` in
 *    the test fails `tsc` if ANY field is added — verified by mutation, including an OPTIONAL one.
 *    ⚠️ But scope that claim honestly: it guards `ReviewSignals` ONLY. The streak reaches
 *    `crossedStreakMilestone` as a bare `number`, never through `ReviewSignals`, so the type pin
 *    is NOT what stops the wrong streak being passed. A mutation run wired HomeScreen's server
 *    win/loss streak straight in and it passed `tsc` and all 1,048 tests.
 *    What actually holds today is arithmetic: every milestone is positive, so a NEGATIVE streak
 *    can never cross the ladder — the "asking mid-losing-streak" outcome is blocked. A POSITIVE
 *    7-game poker win streak WOULD cross, silently turning a gambling-outcome signal into a study
 *    moment. Q1.4b must guarantee the caller passes the study-day streak; nothing here can.
 *  - The rate-limit CONSTANTS are pinned to their literal values, not merely referenced
 *    symbolically. A mutation run proved the symbolic-only tests stayed green with the moments
 *    gate set to 0 — rate limiting was dialable to nothing with CI applauding.
 *  - Nothing here promises the native dialog will appear.
 */

export type ReviewMomentKind =
  | 'drill_strong'
  | 'game_summary'
  | 'streak_milestone';

export const REVIEW_MOMENT_KINDS: readonly ReviewMomentKind[] = [
  'drill_strong',
  'game_summary',
  'streak_milestone',
] as const;

export interface ReviewPromptState {
  /** Epoch ms, stamped once on first load. We do not know a pre-upgrade user's real install date. */
  installedAt: number;
  /** Monotonic count of qualifying moments. */
  moments: number;
  /** Highest streak MILESTONE (not raw streak value) already counted. See STREAK_MILESTONES. */
  streakMilestoneHigh: number;
  /** Epoch ms the native review was last REQUESTED. */
  lastPromptedAt: number | null;
  /** App versions in which the review was requested. */
  promptedVersions: string[];
  /** Dedupe keys for moments that can re-fire on screen re-entry (e.g. a game id). */
  countedKeys: string[];
}

export interface ReviewSignals {
  nowMs: number;
  appVersion: string;
}

export type EligibilityReason =
  | 'ok'
  | 'too_new'
  | 'too_few_moments'
  | 'already_this_version'
  | 'cooldown';

export interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const INSTALL_AGE_FLOOR_MS = 3 * DAY_MS;
export const MIN_QUALIFYING_MOMENTS = 3;
export const PROMPT_COOLDOWN_MS = 90 * DAY_MS;

/** Bound on `countedKeys` so the dedupe list cannot grow without limit. */
export const MAX_COUNTED_KEYS = 50;

/**
 * Study-streak milestones. The first implementation compared the raw streak VALUE against a
 * high-water mark, so days 7, 8, 9… each counted — a 30-day streak manufactured 24 qualifying
 * moments and cleared the 3-moment gate from one signal in three days.
 */
export const STREAK_MILESTONES: readonly number[] = [7, 30, 100] as const;

/** Dwell per moment kind — long enough for that moment's own celebration to finish. */
export const DWELL_MS: Record<ReviewMomentKind, number> = {
  /** Game-end Celebration runs ~5.04s; clear it, then leave a beat. */
  game_summary: 7000,
  /** Study success Celebration runs ~1.5s. */
  drill_strong: 3000,
  /** No celebration of its own. */
  streak_milestone: 2000,
};

/**
 * Reasons are ordered most-fundamental first, so the reported reason is the useful one. Tests
 * assert the reason, not just the boolean — a test that only checks `false` passes for the wrong
 * cause and keeps passing after the logic breaks. That exact false positive shipped in this
 * suite's first draft (an "unhappy user is suppressed" test that actually passed on the cooldown
 * branch and would have passed with the sentiment field deleted entirely).
 */
export function evaluateReviewPrompt(state: ReviewPromptState, signals: ReviewSignals): EligibilityResult {
  if (signals.nowMs - state.installedAt < INSTALL_AGE_FLOOR_MS) {
    return { eligible: false, reason: 'too_new' };
  }
  if (state.moments < MIN_QUALIFYING_MOMENTS) {
    return { eligible: false, reason: 'too_few_moments' };
  }
  if (state.promptedVersions.includes(signals.appVersion)) {
    return { eligible: false, reason: 'already_this_version' };
  }
  if (state.lastPromptedAt !== null && signals.nowMs - state.lastPromptedAt < PROMPT_COOLDOWN_MS) {
    return { eligible: false, reason: 'cooldown' };
  }
  return { eligible: true, reason: 'ok' };
}

/**
 * The highest milestone reached by `streak` that is strictly above `alreadyCounted`, else null.
 * Returns the MILESTONE, so the caller stores a milestone and never a raw streak value.
 */
export function crossedStreakMilestone(streak: number, alreadyCounted: number): number | null {
  let crossed: number | null = null;
  for (const m of STREAK_MILESTONES) {
    if (streak >= m && m > alreadyCounted) crossed = m;
  }
  return crossed;
}

export interface PresentInput {
  dwellElapsedMs: number;
  requiredDwellMs: number;
  isCelebrating: boolean;
}

/**
 * There is no geometry here: we ask the OS to show ITS dialog, so there is no protected region of
 * ours to reason about. What remains is "let the moment's own celebration finish first".
 *
 * ⚠️ NOT SUFFICIENT ON ITS OWN, and no consumer exists yet. The Q1.4 fleet proved a dwell check is
 * necessary but nowhere near enough: a pending request must ALSO expire (the dwell is a minimum,
 * never a maximum — an armed request survived a 48-hour wall-clock gap and fired mid-game), clear
 * on backgrounding, and refuse to fire while a game is Active. Q1.4b owns those gates; do not wire
 * this function to a firing path without them.
 */
export function canPresentNow(input: PresentInput): boolean {
  if (input.dwellElapsedMs < input.requiredDwellMs) return false;
  if (input.isCelebrating) return false;
  return true;
}
