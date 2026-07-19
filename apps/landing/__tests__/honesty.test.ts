import { describe, it, expect } from 'vitest';
import {
  PREMIUM_FEATURES,
  liveFeatures,
  comingSoonFeatures,
} from '../lib/features';
import { STORE_BADGES } from '../lib/stores';

describe('honesty model', () => {
  it('free-first launch: ZERO live features — nothing is purchasable', () => {
    expect(PREMIUM_FEATURES.filter((f) => f.live)).toHaveLength(0);
    expect(liveFeatures()).toEqual([]);
    expect(comingSoonFeatures()).toHaveLength(PREMIUM_FEATURES.length);
  });

  it('NO feature exposes a buyHref (never sell vapor)', () => {
    expect(PREMIUM_FEATURES.length).toBeGreaterThanOrEqual(4);
    for (const f of PREMIUM_FEATURES) {
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
