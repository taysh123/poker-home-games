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
  | 'v2Splash'; // dual-brand (True Story Labs → T Poker) launch splash

/** Production defaults — every new surface OFF so prod behaves exactly as today. */
const PROD_FLAGS: Record<FeatureFlag, boolean> = {
  bankroll: false,
  study: false,
  coach: false,
  v2Splash: false,
};

/** Dev-only previews. Does not affect production builds (`__DEV__ === false`). */
const DEV_OVERRIDES: Partial<Record<FeatureFlag, boolean>> = {
  v2Splash: true,  // preview the launch splash while developing
  bankroll: true,  // Phase 1 — preview the bankroll tracker in dev (prod stays OFF)
  study: true,     // Phase 2 — preview the study module in dev (prod stays OFF)
  coach: true,     // Phase 3 — preview the AI coach scaffolding in dev (prod stays OFF)
};

const resolved: Record<FeatureFlag, boolean> = {
  ...PROD_FLAGS,
  ...(__DEV__ ? DEV_OVERRIDES : {}),
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return resolved[flag] === true;
}

export const featureFlags: Readonly<Record<FeatureFlag, boolean>> = resolved;
