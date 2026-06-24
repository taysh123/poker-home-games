/**
 * Production feature-flag resolution guard. In a real production build __DEV__ is false and
 * EXPO_PUBLIC_APP_VARIANT is unset, so resolved === PROD_FLAGS. nav5 + onboardingV2 must be ON
 * (Subsystem 1 launch); every other flag must stay OFF so prod stays byte-identical otherwise.
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

  it('every other flag stays OFF in production (prod stays byte-identical)', () => {
    const { featureFlags } = loadFlags();
    const expectedOn = new Set(['nav5', 'onboardingV2']);
    for (const [flag, value] of Object.entries(featureFlags)) {
      expect(value).toBe(expectedOn.has(flag));
    }
  });
});
