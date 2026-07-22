/**
 * Upgrade-trigger vocabulary (Wave 0.2 — moved ahead of the E.1 registry so impression events
 * emit STABLE ids from day one; renaming an id later breaks funnel continuity in PostHog).
 *
 * A trigger id names ONE surface where the app shows an honest premium affordance (a lock, a
 * "coming soon" nudge, a teaser row). While the `paywall` flag is OFF none of these route to any
 * purchase UI — ids exist for measurement and, at E.1, for the central registry (eligibility,
 * cooldowns, copy). Add new surfaces HERE first; never mint ad-hoc strings at call sites.
 */
export const TRIGGER_IDS = [
  'trainer_daily_limit', // Spot Trainer — shared practice pool exhausted
  'quiz_daily_limit',    // Quiz runner — daily quiz cap reached
  'study_home_library',  // Study home — locked full-library section
  'lesson_locked',       // Lessons list — locked module row
  'pack_detail',         // Pack detail — premium pack view
  'profile_teaser',      // Profile — "Premium · Coming soon" row
  'profile',             // Profile — Cloud Sync card / subscription row
  'coach_upgrade',       // Coach home — upgrade affordance (coach flag OFF in prod)
  'coach_no_credits',    // Coach input — out of credits (coach flag OFF in prod)
  'coach_teaser',        // E.1 — honest "AI Coach coming soon" card (decision 7)
  'landing_monthly',     // Web landing — monthly plan CTA (paywall-gated route)
  'landing_yearly',      // Web landing — yearly plan CTA (paywall-gated route)
] as const;

export type TriggerId = (typeof TRIGGER_IDS)[number];

export function isTriggerId(v: string): v is TriggerId {
  return (TRIGGER_IDS as readonly string[]).includes(v);
}
