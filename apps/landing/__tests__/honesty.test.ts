import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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

  it('store badges expose NO href UNLESS that store listing is actually live', () => {
    // The badge honesty rule inverted 2026-08-04: the original guard (no badge may EVER link,
    // because nothing was shipped) structurally blocked linking the listing once the iOS app
    // actually went live — under-claiming a real, live product. The rule now is per-badge: an
    // href is allowed ONLY for a store where the app has genuinely shipped.
    expect(STORE_BADGES.length).toBeGreaterThan(0);
    for (const badge of STORE_BADGES) {
      if (badge.href) expect(badge.href).toMatch(/^https:\/\//);
    }
  });
});

describe('store badges — live listings must link out; unshipped ones must not', () => {
  it('the App Store badge links to the real, live listing — the exact owner-verified URL', () => {
    // T Poker 1.1.1 is live on the App Store. This literal must never be regenerated or guessed
    // by an agent — it is the one the owner confirmed by hand.
    const appStore = STORE_BADGES.find((b) => b.key === 'app_store');
    expect(appStore?.href).toBe('https://apps.apple.com/app/t-poker-poker-trainer/id6781109023');
  });

  it('the Google Play badge has NO href — the app is not live there yet', () => {
    const googlePlay = STORE_BADGES.find((b) => b.key === 'google_play');
    expect(googlePlay?.href).toBeUndefined();
  });

  it('StoreBadges actually renders a real anchor for a badge with an href, not a disabled div', () => {
    // Source-anchored: this app has no component-render harness (no @testing-library/react
    // dependency), matching structuredData.test.ts's own approach of reading the real file.
    const src = readFileSync(resolve(__dirname, '../components/ui/StoreBadges.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(src).toMatch(/badge\.href/);
    expect(src).toMatch(/<a\b/);
    // The disabled-badge path must still exist for badges WITHOUT an href.
    expect(src).toMatch(/aria-disabled/);
  });
});
