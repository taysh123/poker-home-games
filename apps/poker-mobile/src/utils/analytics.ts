/**
 * Analytics seam (V2.1) + consent-gated PostHog dispatch (Wave 0.2).
 *
 * Call `track(event, props?)` anywhere — call sites never change. Events buffer in memory (and log
 * in dev). NOTHING leaves the device unless ALL of these hold (pinned by analyticsDispatch.test.ts):
 *
 *   1. the `analytics` feature flag is ON (build-level kill-switch),
 *   2. the user has made their explicit Welcome choice — the consent boundary per the free-first
 *      spec §5.6.6 and master-plan decision 5 (grantAnalyticsConsent() is called from BOTH Welcome
 *      arms; pre-existing users who chose before the marker existed are migrated at startup),
 *   3. the user has not opted out (Profile → "Share anonymous usage analytics"),
 *   4. a PostHog key is configured at build time (EXPO_PUBLIC_POSTHOG_KEY; EU host default).
 *
 * Guests are ANONYMOUS: the SDK's random device id only — identify() is called solely for
 * signed-in users (AuthContext). Events carry feature-usage data, never game amounts, player
 * names, or hand contents (call-site discipline — keep props to ids/counters/flags).
 *
 * Also holds the onboarding "signup intent" marker so `account_created` can be attributed to the
 * onboarding funnel.
 */
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import * as storage from './storage';
import { isFeatureEnabled } from '../config/features';

export type AnalyticsEvent =
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'first_action_completed'
  // Wave 1 — Quiet Luxury funnel. Props are step/answer IDS + flags ONLY; the optional typed
  // name is display-only and must NEVER appear in an event (screen-test pinned).
  | 'funnel_step_answered'
  | 'funnel_completed'
  | 'account_created'
  // Entry chooser (Welcome)
  | 'welcome_shown'
  | 'welcome_guest'
  | 'welcome_signin'
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
  // STEP 5.2 — Tier 2 (engagement loop)
  | 'study_trainer_started'
  | 'study_spot_answered'
  | 'study_trainer_finished'
  | 'study_quiz_completed'
  | 'study_question_reported'
  | 'study_lesson_completed'
  | 'bankroll_session_logged'
  | 'group_created'
  | 'group_joined'
  | 'achievement_unlocked'
  | 'rank_up'
  // Wave 0.2 — honest upgrade-surface impressions (trigger ids: features/premium/triggers.ts)
  | 'nudge_impression'
  | 'analytics_opt_out'
  | 'analytics_opt_in'
  | (string & {});

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

interface BufferedEvent { event: string; props?: AnalyticsProps; at: string }

const buffer: BufferedEvent[] = [];
const MAX_BUFFER = 200;

// ── Consent + provider state (module-level; loaded once at startup) ─────────────
const CONSENT_KEY = 'tpoker.analytics.consent.v1'; // '1' ⇒ the Welcome choice happened
const OPT_OUT_KEY = 'tpoker.analytics.optout.v1';  // '1' ⇒ user disabled sharing in Profile

interface PostHogClientLike {
  capture(event: string, props?: Record<string, unknown>): void;
  identify(distinctId: string): void;
  reset(): void;
  flush(): Promise<void> | void;
  optOut(): Promise<void> | void;
  optIn(): Promise<void> | void;
}

let consentGranted = false;
let optedOut = false;
let client: PostHogClientLike | null = null;
let drained = 0; // buffer index up to which events have been handed to the SDK
let appStateSub: NativeEventSubscription | null = null;

const posthogKey = (): string => process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const posthogHost = (): string => process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

/** The full gate, pure and inspectable: flag AND consent AND not-opted-out AND key present. */
export function canSendAnalytics(gate: {
  flagOn: boolean; consentGranted: boolean; optedOut: boolean; hasKey: boolean;
}): boolean {
  return gate.flagOn && gate.consentGranted && !gate.optedOut && gate.hasKey;
}

function gateNow(): boolean {
  return canSendAnalytics({
    flagOn: isFeatureEnabled('analytics'),
    consentGranted,
    optedOut,
    hasKey: posthogKey().length > 0,
  });
}

function startClientIfAllowed(): void {
  if (client || !gateNow()) return;
  try {
    // Lazy require: the SDK module is never even loaded pre-consent / when dark.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PostHog = require('posthog-react-native').default;
    client = new PostHog(posthogKey(), {
      host: posthogHost(),
      flushAt: 20,
      flushInterval: 30000,
    }) as PostHogClientLike;
    // Flush pending events when the app backgrounds so short sessions aren't lost.
    appStateSub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background') void client?.flush();
    });
    // Drain this session's pre-consent funnel events (welcome_shown etc.) — consent covers them.
    for (; drained < buffer.length; drained++) {
      const e = buffer[drained];
      client.capture(e.event, { ...e.props, client_ts: e.at });
    }
  } catch {
    client = null; // SDK unavailable (e.g. web bundle edge) → stay dark, never crash the app
  }
}

function dispatch(entry: BufferedEvent): void {
  if (!gateNow()) return;
  startClientIfAllowed();
  if (!client) return;
  if (drained < buffer.length) drained = buffer.length; // this entry is the buffer tail
  client.capture(entry.event, { ...entry.props, client_ts: entry.at });
}

export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  const entry: BufferedEvent = { event, props, at: new Date().toISOString() };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) { buffer.shift(); if (drained > 0) drained--; }
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', event, props ?? {});
  }
  dispatch(entry);
}

/**
 * App startup (App.tsx): load persisted consent/opt-out, migrate users whose explicit choice
 * predates the consent marker (they completed onboarding or signed in before Wave 0.2), and
 * start the client if the full gate passes.
 */
export async function initAnalytics(): Promise<void> {
  if (!isFeatureEnabled('analytics')) return;
  try {
    const [consentV, optOutV] = await Promise.all([
      storage.getItemAsync(CONSENT_KEY),
      storage.getItemAsync(OPT_OUT_KEY),
    ]);
    optedOut = optOutV === '1';
    if (consentV === '1') {
      consentGranted = true;
    } else {
      // Migration: an existing onboarded/signed-in user already made the Welcome-era choice.
      const [seen, user] = await Promise.all([
        storage.getItemAsync('hasSeenOnboarding'),
        storage.getItemAsync('user'),
      ]);
      if (seen === 'true' || !!user) {
        consentGranted = true;
        void storage.setItemAsync(CONSENT_KEY, '1').catch(() => {});
      }
    }
  } catch {
    /* storage unavailable → stay dark (fail-closed) */
  }
  startClientIfAllowed();
}

/** The user's explicit Welcome choice — called from BOTH chooser arms. Idempotent. */
export async function grantAnalyticsConsent(): Promise<void> {
  consentGranted = true;
  try { await storage.setItemAsync(CONSENT_KEY, '1'); } catch { /* latch still granted for this session */ }
  startClientIfAllowed();
}

/** Profile → "Share anonymous usage analytics" toggle. Persisted; effective immediately. */
export async function setAnalyticsOptOut(nextOptedOut: boolean): Promise<void> {
  const wasSendable = gateNow();
  optedOut = nextOptedOut;
  try {
    if (nextOptedOut) await storage.setItemAsync(OPT_OUT_KEY, '1');
    else await storage.deleteItemAsync(OPT_OUT_KEY);
  } catch { /* best-effort persistence; the in-memory gate applies regardless */ }
  if (nextOptedOut) {
    if (wasSendable) track('analytics_opt_out'); // recorded in the buffer; not sent (gate now closed)
    void client?.optOut();
  } else {
    void client?.optIn();
    startClientIfAllowed();
    track('analytics_opt_in');
  }
}

/** For the Profile toggle UI. */
export function isAnalyticsSharingEnabled(): boolean {
  return consentGranted && !optedOut;
}

/** Signed-in users are identified so WAPP counts real players; guests stay anonymous. */
export function identifyAnalyticsUser(userId: string): void {
  if (!client || !gateNow()) return;
  client.identify(userId);
}

/** Logout → drop the identity link (back to an anonymous device id). */
export function resetAnalyticsIdentity(): void {
  client?.reset();
}

/** Debug/test helper — the in-memory event log. */
export function getBufferedEvents(): readonly BufferedEvent[] {
  return buffer.slice();
}

/** Test-only: reset module state (consent latch, client, buffer) between cases. */
export function __resetAnalyticsForTests(): void {
  consentGranted = false;
  optedOut = false;
  client = null;
  drained = 0;
  buffer.length = 0;
  appStateSub?.remove();
  appStateSub = null;
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
