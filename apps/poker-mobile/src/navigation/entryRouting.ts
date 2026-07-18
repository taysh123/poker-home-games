/**
 * Pure entry-routing spec for the guest (signed-out) tree.
 *
 * Scope update B (entry choice): with the `welcome` flag ON, signed-out users land
 * on the Welcome chooser and enter guest mode only by explicit choice — local guest
 * data is untouched either way (the chooser never writes storage). With the flag
 * OFF (kill-switch) the legacy silent-guest behavior is preserved exactly.
 *
 * AppNavigator feeds `initialGuestRoute` into the guest tree's `initialRouteName`,
 * so this module is load-bearing, not documentation. Signed-in users never reach
 * these routes — the authed tree mounts MainTabs (Home) directly.
 */

export type GuestEntryRoute = 'Landing' | 'Welcome' | 'Onboarding' | 'MainTabs';

export function initialGuestRoute(opts: {
  /** Web-root marketing page (paywall flag + web + unauthed + root path). */
  showLanding: boolean;
  /** `welcome` feature flag. */
  welcomeEnabled: boolean;
  hasSeenOnboarding: boolean;
}): GuestEntryRoute {
  // The landing page is itself a chooser (pricing/sign-in/try) — never double-gate it.
  if (opts.showLanding) return 'Landing';
  if (opts.welcomeEnabled) return 'Welcome';
  // Legacy (flag off): first run → onboarding, otherwise straight into the guest app.
  return opts.hasSeenOnboarding ? 'MainTabs' : 'Onboarding';
}

/**
 * Where "Continue as guest" lands: first-run guests get the onboarding funnel
 * (pillar slides + starting-point router); returning guests resume their app.
 */
export function guestContinueTarget(hasSeenOnboarding: boolean): 'Onboarding' | 'MainTabs' {
  return hasSeenOnboarding ? 'MainTabs' : 'Onboarding';
}

/**
 * Logout target. Both trees register `MainTabs`, so React Navigation PRESERVES it
 * across the authed → guest tree swap — `initialRouteName` never re-applies, and
 * without an explicit reset a signed-out user silently lands on guest Home. With
 * the `welcome` flag on, logout must land on the explicit Welcome chooser instead.
 * Returns null when no reset is wanted (kill-switch off, or the web marketing
 * Landing owns the root — it is its own chooser).
 */
export function logoutResetRoute(opts: {
  showLanding: boolean;
  welcomeEnabled: boolean;
  hasSeenOnboarding: boolean;
}): { name: 'Welcome'; params: { firstRun: boolean } } | null {
  if (!opts.welcomeEnabled || opts.showLanding) return null;
  return { name: 'Welcome', params: { firstRun: !opts.hasSeenOnboarding } };
}
