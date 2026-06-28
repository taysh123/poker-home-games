import { describe, it, expect } from 'vitest';
import {
  PREMIUM_FEATURES,
  liveFeatures,
  comingSoonFeatures,
} from '../lib/features';
import { STORE_BADGES } from '../lib/stores';

describe('honesty model', () => {
  it('has exactly one live feature, and it is premium_study', () => {
    const live = PREMIUM_FEATURES.filter((f) => f.live);
    expect(live).toHaveLength(1);
    expect(live[0].key).toBe('premium_study');
    expect(liveFeatures()).toEqual(live);
  });

  it('the only live feature exposes a buyHref pointing at the app', () => {
    const study = PREMIUM_FEATURES.find((f) => f.key === 'premium_study');
    expect(study).toBeDefined();
    expect(study?.live).toBe(true);
    expect(study?.buyHref).toBeTruthy();
  });

  it('every non-live feature has NO buyHref (never sell vapor)', () => {
    const coming = comingSoonFeatures();
    expect(coming.length).toBeGreaterThan(0);
    for (const f of coming) {
      expect(f.live).toBe(false);
      expect(f.buyHref).toBeUndefined();
    }
  });

  it('store badges expose NO href (coming soon, not links)', () => {
    expect(STORE_BADGES.length).toBeGreaterThan(0);
    for (const badge of STORE_BADGES) {
      expect('href' in badge).toBe(false);
      // @ts-expect-error — `href` must not exist on the StoreBadge type
      expect(badge.href).toBeUndefined();
    }
  });
});
