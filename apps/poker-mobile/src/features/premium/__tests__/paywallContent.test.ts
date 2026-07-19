import { PREMIUM_FEATURES, liveFeatureKeys, isFeatureLive, paywallPriceFor, PRICING } from '../config';

describe('paywall content rules', () => {
  it('free-first: NOTHING is live — every feature is Soon', () => {
    expect(liveFeatureKeys()).toEqual([]);
    for (const f of PREMIUM_FEATURES) {
      expect(isFeatureLive(f.key)).toBe(false);
    }
  });

  it('a Soon feature must never be the purchasable CTA target', () => {
    // The screen only ever charges for live features; assert no Soon feature is "live".
    const soon = PREMIUM_FEATURES.filter(f => f.comingSoon);
    expect(soon.every(f => !isFeatureLive(f.key))).toBe(true);
  });

  it('price uses the SDK-localized value when present, else the config fallback', () => {
    expect(paywallPriceFor('yearly', undefined)).toBe(PRICING.yearly.price);   // $79.99
    expect(paywallPriceFor('monthly', undefined)).toBe(PRICING.monthly.price); // $8.99
    expect(paywallPriceFor('yearly', '₪399/yr')).toBe('₪399/yr');              // SDK wins
  });
});
