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
  | 'v2Splash'; // dual-brand (True Story Labs → T Poker) launch splash

/** Production defaults — every new surface OFF so prod behaves exactly as today. */
const PROD_FLAGS: Record<FeatureFlag, boolean> = {
  bankroll: false,
  study: false,
  coach: false,
  paywall: false,
  nav5: false,
  onboardingV2: false,
  retention: false,
  reminders: false,
  currencyPrefs: false,
  v2Splash: false,
};

/** Dev-only previews. Does not affect production builds (`__DEV__ === false`). */
const DEV_OVERRIDES: Partial<Record<FeatureFlag, boolean>> = {
  v2Splash: true,  // preview the launch splash while developing
  bankroll: true,  // Phase 1 — preview the bankroll tracker in dev (prod stays OFF)
  study: true,     // Phase 2 — preview the study module in dev (prod stays OFF)
  coach: true,     // Phase 3 — preview the AI coach scaffolding in dev (prod stays OFF)
  paywall: true,   // Phase 5 — preview the paywall + upgrade flow in dev (prod stays OFF)
  nav5: true,      // V2.1 — preview the 5-tab IA + Track hub in dev (prod stays OFF)
  onboardingV2: true, // V2.1 — preview the pillar-led onboarding in dev (prod stays OFF)
  retention: true, // V2.1 STEP 3 — preview the retention engine in dev (prod stays OFF)
  reminders: true, // V2.1 STEP 3 — preview local reminders in dev (prod stays OFF)
  currencyPrefs: true, // V2.1 STEP 3.5 — preview currency prefs in dev (prod stays OFF)
};

const resolved: Record<FeatureFlag, boolean> = {
  ...PROD_FLAGS,
  ...(__DEV__ ? DEV_OVERRIDES : {}),
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return resolved[flag] === true;
}

export const featureFlags: Readonly<Record<FeatureFlag, boolean>> = resolved;
