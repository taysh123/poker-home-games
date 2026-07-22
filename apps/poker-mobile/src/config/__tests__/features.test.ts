/**
 * Production feature-flag resolution guard. In a real production build __DEV__ is false and
 * EXPO_PUBLIC_APP_VARIANT is unset, so resolved === PROD_FLAGS. nav5 + onboardingV2 must be ON
 * (Subsystem 1 launch); study + content + retention ON (Phase 1 free-training-taste); immersive ON
 * (felt surfaces — launch decision); paywall/coach/solver/mastery and all others must stay OFF.
 */
describe('feature flags — production resolution', () => {
  const ORIGINAL_DEV = (global as any).__DEV__;
  const ORIGINAL_VARIANT = process.env.EXPO_PUBLIC_APP_VARIANT;

  beforeEach(() => {
    (global as any).__DEV__ = false;
    delete process.env.EXPO_PUBLIC_APP_VARIANT;
  });

  afterEach(() => {
    (global as any).__DEV__ = ORIGINAL_DEV;
    if (ORIGINAL_VARIANT === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
    else process.env.EXPO_PUBLIC_APP_VARIANT = ORIGINAL_VARIANT;
    jest.resetModules();
  });

  function loadFlags() {
    let mod: typeof import('../features');
    jest.isolateModules(() => {
      mod = require('../features');
    });
    return mod!;
  }

  it('nav5 is ON in production', () => {
    const { isFeatureEnabled } = loadFlags();
    expect(isFeatureEnabled('nav5')).toBe(true);
  });

  it('onboardingV2 is ON in production', () => {
    const { isFeatureEnabled } = loadFlags();
    expect(isFeatureEnabled('onboardingV2')).toBe(true);
  });

  it('v2Splash is ON in production (launch splash — flag remains the kill-switch)', () => {
    const { isFeatureEnabled } = loadFlags();
    expect(isFeatureEnabled('v2Splash')).toBe(true);
  });

  it('welcome is ON in production (entry chooser — flag remains the kill-switch)', () => {
    const { isFeatureEnabled } = loadFlags();
    expect(isFeatureEnabled('welcome')).toBe(true);
  });

  it('every other flag stays OFF in production (paywall/coach/solver/mastery stay OFF)', () => {
    const { featureFlags } = loadFlags();
    const expectedOn = new Set([
      'nav5', 'onboardingV2', 'study', 'content', 'retention', 'immersive',
      'v2Splash', 'welcome',
      // Wave 0.2 — analytics DISPATCH kill-switch (intentional extension, not a weakening):
      // sends are additionally gated on the user's explicit Welcome-choice consent + a build-time
      // PostHog key; see utils/analytics.ts + utils/__tests__/analyticsDispatch.test.ts.
      'analytics',
    ]);
    for (const [flag, value] of Object.entries(featureFlags)) {
      expect(value).toBe(expectedOn.has(flag));
    }
  });
});
