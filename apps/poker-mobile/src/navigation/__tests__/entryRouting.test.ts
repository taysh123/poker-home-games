/**
 * Entry routing (scope update B — explicit guest choice instead of silent guest).
 *
 * Pure spec of the guest tree's initial route + the Welcome chooser's
 * "Continue as guest" target. Signed-in users never reach these — the authed
 * tree mounts MainTabs (Home) directly.
 */
import { initialGuestRoute, guestContinueTarget } from '../entryRouting';

describe('initialGuestRoute', () => {
  it('shows the Welcome chooser to signed-out users when the welcome flag is on', () => {
    expect(
      initialGuestRoute({ showLanding: false, welcomeEnabled: true, hasSeenOnboarding: true }),
    ).toBe('Welcome');
  });

  it('shows Welcome even on first run (onboarding comes after the explicit guest choice)', () => {
    expect(
      initialGuestRoute({ showLanding: false, welcomeEnabled: true, hasSeenOnboarding: false }),
    ).toBe('Welcome');
  });

  it('lets the web marketing Landing win over Welcome (Landing is its own chooser)', () => {
    expect(
      initialGuestRoute({ showLanding: true, welcomeEnabled: true, hasSeenOnboarding: true }),
    ).toBe('Landing');
    expect(
      initialGuestRoute({ showLanding: true, welcomeEnabled: false, hasSeenOnboarding: false }),
    ).toBe('Landing');
  });

  it('kill-switch (welcome off): legacy behavior — Onboarding on first run', () => {
    expect(
      initialGuestRoute({ showLanding: false, welcomeEnabled: false, hasSeenOnboarding: false }),
    ).toBe('Onboarding');
  });

  it('kill-switch (welcome off): legacy behavior — silent guest MainTabs for returners', () => {
    expect(
      initialGuestRoute({ showLanding: false, welcomeEnabled: false, hasSeenOnboarding: true }),
    ).toBe('MainTabs');
  });
});

describe('guestContinueTarget', () => {
  it('first-run guests go through the onboarding funnel (pillar slides + router)', () => {
    expect(guestContinueTarget(false)).toBe('Onboarding');
  });

  it('returning guests land straight on MainTabs with their local data intact', () => {
    expect(guestContinueTarget(true)).toBe('MainTabs');
  });
});
