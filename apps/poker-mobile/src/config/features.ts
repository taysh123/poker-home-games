/**
 * V2 feature flags.
 *
 * New V2 surfaces ship OFF in production so the live app is unchanged until each
 * feature is ready — flip a flag here to reveal it. Development builds (`__DEV__`)
 * can preview in-progress features via DEV_OVERRIDES without affecting production.
 *
 * This is the single switchboard for the gradual Four-Pillars migration
 * (Play → Track → Study → Improve): each pillar lights up behind its flag.
 */
export type FeatureFlag =
  | 'bankroll'  // Track pillar — bankroll / session tracker (Phase 1)
  | 'study'     // Study pillar — preflop GTO (Phase 2)
  | 'coach'     // Improve pillar — AI hand-analysis coach (Phase 3)
  | 'paywall'   // Monetization — premium paywall + upgrade prompts (Phase 5)
  | 'nav5'      // V2.1 — 5-tab IA (Home/Track/Study/Coach/Groups) + Track hub
  | 'onboardingV2' // V2.1 — pillar-led onboarding + starting-point router
  | 'retention' // V2.1 STEP 3 — streak-freeze, daily-goal, XP/rank, achievements, cross-pillar loops
  | 'reminders' // V2.1 STEP 3 — local scheduled re-engagement notifications + preferences
  | 'currencyPrefs' // V2.1 STEP 3.5 — preferred currency + Intl formatting (off ⇒ ₪ ILS)
  | 'polish'    // V2.1 STEP 4 — UX polish (error/offline states, contrast, reduced-motion, etc.)
  | 'coachScreenshot' // V2.1 STEP 4 — Coach screenshot input (hidden until real image pipeline ships)
  | 'immersive' // V2.1 STEP 5.3 — immersive poker-table presentation (session/study/training/coach)
  | 'content'   // V2.2 — content platform (workbook 0.8.1): ContentStore / lessons / quizzes / packs (prod OFF)
  | 'mastery'   // V2.2 — analytics → mastery engine (prod OFF)
  | 'solver'    // Web-first flagship — solver workspace + range-table hover inspector (prod OFF)
  | 'publicSpots' // Future — shared/public spot library (design-only; prod OFF everywhere)
  | 'v2Splash'  // branded launch splash (BrandSplash overlay on cold start)
  | 'welcome'   // entry chooser — signed-out users pick "Continue as guest" / "Sign in" (no silent guest)
  | 'analytics'; // Wave 0.2 — PostHog EU dispatch (kill-switch; consent-gated inside utils/analytics)

/** Production defaults — nav5 + onboardingV2 ON (Subsystem 1 launch); study/content/retention ON (Phase 1 free-training-taste); immersive ON (felt surfaces — launch decision). */
export const PROD_FLAGS: Record<FeatureFlag, boolean> = {
  bankroll: false,
  study: true,
  coach: false,
  paywall: false,
  nav5: true,
  onboardingV2: true,
  retention: true,
  // Wave 0.3 — streak/daily-study reminders ON (native-only local notifications). Flipped only
  // after the free_ai reminder kind was REMOVED (it advertised a non-live AI analysis) — pinned
  // by the honesty test in utils/__tests__/reminderLogic.test.ts.
  reminders: true,
  currencyPrefs: false,
  polish: false,
  coachScreenshot: false,
  immersive: true, // launch decision — felt surfaces (live cash table + both summaries) ON in prod
  content: true,
  mastery: false,
  solver: false,
  publicSpots: false,
  // Launch decision (2026-07-05): splash + entry chooser ship ON. Each flag is an
  // independent kill-switch — v2Splash:false removes the splash overlay entirely;
  // welcome:false restores the legacy silent-guest entry (see navigation/entryRouting.ts).
  v2Splash: true,
  welcome: true,
  // Wave 0.2 — analytics dispatch ships ON as a kill-switch only: nothing sends unless the user
  // has made their explicit Welcome choice (consent latch in utils/analytics) AND a PostHog key
  // is configured at build time. Flag OFF ⇒ dispatch is a no-op regardless of consent.
  analytics: true,
};

/**
 * Beta release profile (EAS `beta` profile sets EXPO_PUBLIC_APP_VARIANT=beta). Enables the full V2
 * testing experience in a REAL release build while keeping billing/paywall OFF and the screenshot
 * placeholder hidden. Production builds (no variant) are unaffected → behave exactly as today.
 */
const BETA_FLAGS: Partial<Record<FeatureFlag, boolean>> = {
  nav5: true,
  onboardingV2: true,
  bankroll: true,
  study: true,
  coach: true,            // shown only as a clearly-labeled DEMO (mock provider)
  retention: true,
  reminders: true,
  currencyPrefs: true,
  polish: true,
  immersive: true,
  content: true,
  mastery: true,
  solver: true,           // preview the solver workspace in beta
  v2Splash: true,
  welcome: true,
  paywall: false,         // OFF in beta — no production paywall
  coachScreenshot: false, // OFF — partial upload not exposed
  analytics: true,        // Wave 0.2 — same consent-gated dispatch as prod
};

/** Dev-only previews. Does not affect production builds (`__DEV__ === false`). */
const DEV_OVERRIDES: Partial<Record<FeatureFlag, boolean>> = {
  v2Splash: true,  // preview the launch splash while developing
  welcome: true,   // preview the entry chooser while developing
  bankroll: true,  // Phase 1 — preview the bankroll tracker in dev (prod stays OFF)
  study: true,     // Phase 2 — preview the study module in dev (prod stays OFF)
  coach: true,     // Phase 3 — preview the AI coach scaffolding in dev (prod stays OFF)
  paywall: true,   // Phase 5 — preview the paywall + upgrade flow in dev (prod stays OFF)
  nav5: true,      // V2.1 — preview the 5-tab IA + Track hub in dev (prod stays OFF)
  onboardingV2: true, // V2.1 — preview the pillar-led onboarding in dev (prod stays OFF)
  retention: true, // V2.1 STEP 3 — preview the retention engine in dev (prod stays OFF)
  reminders: true, // V2.1 STEP 3 — preview local reminders in dev (prod stays OFF)
  currencyPrefs: true, // V2.1 STEP 3.5 — preview currency prefs in dev (prod stays OFF)
  polish: true,    // V2.1 STEP 4 — preview UX polish in dev (prod stays OFF)
  immersive: true, // V2.1 STEP 5.3 — preview the immersive poker-table UI in dev (prod stays OFF)
  content: true,   // V2.2 — preview the content platform in dev (prod stays OFF)
  mastery: true,   // V2.2 — preview mastery in dev (prod stays OFF)
  solver: true,    // Web-first — preview the solver workspace in dev (prod stays OFF)
  analytics: true, // Wave 0.2 — dev preview (sends still require consent + an EXPO_PUBLIC_POSTHOG_KEY)
  // coachScreenshot + publicSpots intentionally OFF in dev too (image pipeline / public sharing not built).

};

/**
 * Resolution order (later wins): production defaults → beta overrides (release beta builds) →
 * dev overrides. Production builds get PROD_FLAGS only, so prod behavior is byte-identical.
 */
const isBeta = process.env.EXPO_PUBLIC_APP_VARIANT === 'beta';

const resolved: Record<FeatureFlag, boolean> = {
  ...PROD_FLAGS,
  ...(isBeta ? BETA_FLAGS : {}),
  ...(__DEV__ ? DEV_OVERRIDES : {}),
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return resolved[flag] === true;
}

export const featureFlags: Readonly<Record<FeatureFlag, boolean>> = resolved;
