/**
 * Thin AsyncStorage wrapper for the review-prompt state. FAIL-SAFE by design: a corrupt or
 * partially-written payload loads as defaults, and writes never throw. A rating prompt is never
 * worth crashing a session over.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_COUNTED_KEYS, type ReviewPromptState } from '../logic/reviewPromptLogic';

export const REVIEW_PROMPT_KEY = 'tpoker.reviewPrompt.v1';

export function defaultReviewPromptState(nowMs: number): ReviewPromptState {
  return {
    installedAt: nowMs,
    moments: 0,
    streakMilestoneHigh: 0,
    lastPromptedAt: null,
    promptedVersions: [],
    countedKeys: [],
  };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === 'string');
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
    isStringArray(s.promptedVersions) &&
    isStringArray(s.countedKeys)
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
    // Bound the dedupe list so it cannot grow forever across a long install.
    const bounded: ReviewPromptState = state.countedKeys.length > MAX_COUNTED_KEYS
      ? { ...state, countedKeys: state.countedKeys.slice(-MAX_COUNTED_KEYS) }
      : state;
    await AsyncStorage.setItem(REVIEW_PROMPT_KEY, JSON.stringify(bounded));
  } catch {
    // best-effort; never throw into the UI
  }
}
