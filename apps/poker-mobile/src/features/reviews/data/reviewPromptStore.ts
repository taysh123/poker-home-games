/**
 * Thin AsyncStorage wrapper for the review-prompt state. FAIL-SAFE by design: a corrupt or
 * partially-written payload loads as defaults, and writes never throw. A rating prompt is never
 * worth crashing a session over.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReviewPromptState } from '../logic/reviewPromptLogic';

export const REVIEW_PROMPT_KEY = 'tpoker.reviewPrompt.v1';

export function defaultReviewPromptState(nowMs: number): ReviewPromptState {
  return {
    installedAt: nowMs,
    moments: 0,
    streakMilestoneHigh: 0,
    lastPromptedAt: null,
    promptedVersions: [],
    lastSentiment: null,
  };
}

function isValid(v: unknown): v is ReviewPromptState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.installedAt === 'number' &&
    Number.isFinite(s.installedAt) &&
    typeof s.moments === 'number' &&
    typeof s.streakMilestoneHigh === 'number' &&
    (s.lastPromptedAt === null || typeof s.lastPromptedAt === 'number') &&
    Array.isArray(s.promptedVersions) &&
    s.promptedVersions.every(x => typeof x === 'string') &&
    (s.lastSentiment === null || s.lastSentiment === 'happy' || s.lastSentiment === 'unhappy')
  );
}

/**
 * Loads the state, stamping `installedAt` exactly once. For a user upgrading from an earlier
 * version this reads as "installed now" — we do not know their real install date and do not
 * pretend to. The >=3-qualifying-moments rule is the real engagement gate; the install-age floor
 * is a short backstop.
 */
export async function loadReviewPromptState(nowMs: number): Promise<ReviewPromptState> {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_PROMPT_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) return parsed;
    }
  } catch {
    // fall through to defaults
  }
  const fresh = defaultReviewPromptState(nowMs);
  await saveReviewPromptState(fresh);
  return fresh;
}

export async function saveReviewPromptState(state: ReviewPromptState): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_PROMPT_KEY, JSON.stringify(state));
  } catch {
    // best-effort; never throw into the UI
  }
}
