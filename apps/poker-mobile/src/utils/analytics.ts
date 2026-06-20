/**
 * Lightweight, production-safe analytics seam (V2.1).
 *
 * Call `track(event, props?)` anywhere. Events are buffered in-memory and logged in dev; a real
 * provider (Amplitude / PostHog / etc.) can be wired in `dispatch()` later WITHOUT touching call
 * sites. Nothing is sent off-device today — safe to ship with no vendor configured.
 *
 * Also holds the onboarding "signup intent" marker so `account_created` can be attributed to the
 * onboarding funnel (the auth layer has no isNewUser flag yet — see report follow-up).
 */
import * as storage from './storage';

export type AnalyticsEvent =
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'first_action_completed'
  | 'account_created'
  // STEP 5.1 — Tier 1 (revenue + core loop)
  | 'paywall_viewed'
  | 'paywall_plan_selected'
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_failed'
  | 'restore_started'
  | 'restore_result'
  | 'coach_analysis_requested'
  | 'coach_analysis_completed'
  | 'coach_analysis_failed'
  | 'local_game_started'
  | 'local_game_finished'
  | (string & {});

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

interface BufferedEvent { event: string; props?: AnalyticsProps; at: string }

const buffer: BufferedEvent[] = [];
const MAX_BUFFER = 200;

export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  const entry: BufferedEvent = { event, props, at: new Date().toISOString() };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', event, props ?? {});
  }
  dispatch(entry);
}

/** Wire a real provider here later (no-op today → production-safe). */
function dispatch(_entry: BufferedEvent): void {
  // TODO(provider): forward to Amplitude/PostHog/Segment when configured.
}

/** Debug/test helper — the in-memory event log. */
export function getBufferedEvents(): readonly BufferedEvent[] {
  return buffer.slice();
}

// ── Onboarding signup-intent (survives the auth round-trip across modals) ──────
const SIGNUP_INTENT_KEY = 'analytics.signupIntent';

/** Mark that the user is heading into sign-in *to create an account* (contextual signup). */
export async function markSignupIntent(): Promise<void> {
  try { await storage.setItemAsync(SIGNUP_INTENT_KEY, '1'); } catch { /* best-effort */ }
}

/** Read + clear the intent. Returns true if a signup intent was pending. */
export async function consumeSignupIntent(): Promise<boolean> {
  try {
    const v = await storage.getItemAsync(SIGNUP_INTENT_KEY);
    if (v) { await storage.deleteItemAsync(SIGNUP_INTENT_KEY); return true; }
  } catch { /* best-effort */ }
  return false;
}
