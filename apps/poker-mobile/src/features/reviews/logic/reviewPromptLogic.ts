/**
 * Review-prompt rules — PURE. Zero imports, `nowMs` injected, no I/O, no React.
 *
 * Consumed by features/reviews/state/ReviewPromptContext.tsx. Everything hard to verify by hand
 * lives here so it can be verified by test instead: iOS caps the native dialog at ~3 prompts/year
 * and may silently no-op, so we can never confirm our own rate limiting by observation.
 *
 * HONESTY CONSTRAINTS (pinned in __tests__/reviewPromptLogic.test.ts):
 *  - The four moment kinds below are the complete producible set.
 *  - ReviewSignals carries NO win/loss streak. Only the STUDY-day streak qualifies; the server
 *    win/loss streak can be negative ("3-game loss streak"), and asking for a rating during a
 *    losing run is the exact failure this prevents. Unrepresentable beats documented.
 *  - Nothing here promises the native dialog will appear.
 */

export type ReviewMomentKind =
  | 'achievement_dismissed'
  | 'drill_strong'
  | 'game_summary'
  | 'streak_milestone';

export const REVIEW_MOMENT_KINDS: readonly ReviewMomentKind[] = [
  'achievement_dismissed',
  'drill_strong',
  'game_summary',
  'streak_milestone',
] as const;

export interface ReviewPromptState {
  /** Epoch ms, stamped once on first load. We do not know a pre-upgrade user's real install date. */
  installedAt: number;
  /** Monotonic count of qualifying moments. */
  moments: number;
  /** Highest study-streak milestone already counted — a streak is a state, not an event. */
  streakMilestoneHigh: number;
  /** Epoch ms the sheet was last SHOWN (not answered). */
  lastPromptedAt: number | null;
  /** App versions in which the sheet was shown. */
  promptedVersions: string[];
  lastSentiment: 'happy' | 'unhappy' | null;
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

/** Conservative height of the sheet's occlusion band, in px. */
export const SHEET_OCCLUSION_H = 240;

export const DWELL_MS = {
  /** Game-end Celebration runs ~5.04s — clear it, then leave reading time on a money screen. */
  game_summary: 7000,
  /** Study success Celebration runs ~1.5s. */
  drill_results: 3000,
} as const;

export type DwellSurface = keyof typeof DWELL_MS;

/**
 * Reasons are ordered most-fundamental first, so the reported reason is the useful one. Tests
 * assert the reason, not just the boolean — a test that only checks `false` passes for the wrong
 * cause and keeps passing after the logic breaks.
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

export interface Region {
  /** Viewport-space Y of the protected block's top edge (negative once scrolled past). */
  top: number;
  bottom: number;
  viewportH: number;
  sheetH: number;
}

export interface RegionState {
  fullyVisibleAboveSheet: boolean;
  intersectsSheet: boolean;
}

/**
 * A dwell timer cannot know whether the user scrolled. This can: it reports both whether the
 * protected block has ever been fully readable above the sheet, and whether the sheet would
 * cover it right now.
 */
export function regionState({ top, bottom, viewportH, sheetH }: Region): RegionState {
  const sheetTop = viewportH - sheetH;
  return {
    fullyVisibleAboveSheet: top >= 0 && bottom <= sheetTop,
    intersectsSheet: bottom > sheetTop && top < viewportH,
  };
}

export interface PresentInput {
  dwellElapsedMs: number;
  requiredDwellMs: number;
  isCelebrating: boolean;
  /** `null` on surfaces with nothing to protect (drill results). */
  protectedRegion: { seen: boolean; intersectsSheet: boolean } | null;
}

export function canPresentNow(input: PresentInput): boolean {
  if (input.dwellElapsedMs < input.requiredDwellMs) return false;
  if (input.isCelebrating) return false;
  if (input.protectedRegion === null) return true;
  return input.protectedRegion.seen && !input.protectedRegion.intersectsSheet;
}
