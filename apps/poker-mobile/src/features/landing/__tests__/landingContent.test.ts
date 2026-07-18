import { PRICING, PREMIUM_FEATURES } from '../../premium/config';
import {
  PREMIUM_STUDY_BENEFIT,
  LANDING_HERO,
  LANDING_TRUST_LINE,
  LANDING_SECTIONS,
  LANDING_PREMIUM,
  landingPlans,
  landingBenefits,
  LANDING_FAQ,
  LANDING_LEGAL_LINKS,
  LANDING_DISCLAIMER,
} from '../landingContent';
import { landingImages } from '../landingImages.web';

describe('landing content — honesty + correctness', () => {
  it('uses the exact Premium Study benefit copy from §7', () => {
    expect(PREMIUM_STUDY_BENEFIT).toBe(
      'Full lesson library — every study pack · all quizzes · unlimited Spot Trainer',
    );
  });

  it('keeps the §7 copy consistent with PREMIUM_FEATURES when premium_study is present', () => {
    const live = PREMIUM_FEATURES.find(f => f.key === 'premium_study');
    if (live) expect(live.desc).toBe(PREMIUM_STUDY_BENEFIT); // guards drift once Subsystem 3 lands
  });

  it('exposes a hero with a non-empty headline and subhead', () => {
    expect(LANDING_HERO.headline.length).toBeGreaterThan(0);
    expect(LANDING_HERO.subhead.length).toBeGreaterThan(0);
  });

  it('hero uses the approved brand headline + explicit chooser CTAs (2026-07-06)', () => {
    expect(LANDING_HERO.headline).toBe('Your home game, handled.');
    expect(LANDING_HERO.primaryCta).toBe('Start a free game');
    expect(LANDING_HERO.secondaryCta).toBe('Sign in');
  });

  it('trust line stays truthful and complete — free · 18+ · not gambling', () => {
    expect(LANDING_TRUST_LINE).toMatch(/free/i);
    expect(LANDING_TRUST_LINE).toMatch(/18\+/);
    expect(LANDING_TRUST_LINE.toLowerCase()).toMatch(/not a gambling product/);
  });

  it('has 7 feature sections (free story → paid pillars), each complete and backed by a bundled screenshot', () => {
    expect(LANDING_SECTIONS).toHaveLength(7);
    for (const s of LANDING_SECTIONS) {
      expect(s.eyebrow.length).toBeGreaterThan(0);
      expect(s.heading.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      expect(s.imageAlt.length).toBeGreaterThan(10);
      expect(['gold', 'felt', 'teal', 'purple']).toContain(s.accent);
      expect(landingImages[s.image]).toBeDefined(); // web bundle actually carries the shot
    }
    expect(LANDING_SECTIONS.map(s => s.key)).toEqual([
      'live', 'settle', 'tournament', 'stats', 'study', 'trainer', 'coach',
    ]);
  });

  it('COPY GUARDRAIL: AI Coach is after-the-fact + expert-calibrated — never solver/GTO-exact/live-advice claims', () => {
    const coach = LANDING_SECTIONS.find(s => s.key === 'coach')!;
    expect(coach.body).toMatch(/expert-calibrated/i);
    expect(coach.body).toMatch(/never live in-game advice/i);
    expect(coach.featureKey).toBe('ai_coach');
    // Locked positioning across ALL landing copy: no solver-verified / GTO-exact claims anywhere.
    const allCopy = LANDING_SECTIONS.map(s => `${s.eyebrow} ${s.heading} ${s.body}`).join(' ');
    expect(allCopy).not.toMatch(/solver[- ]verified|GTO[- ]exact|solver output/i);
  });

  it('sections tied to premium features reference real catalog keys', () => {
    for (const s of LANDING_SECTIONS) {
      if (s.featureKey) {
        expect(PREMIUM_FEATURES.some(f => f.key === s.featureKey)).toBe(true);
      }
    }
  });

  it('FAQ pins the AI-Coach live-advice question with the after-the-fact answer', () => {
    const coachFaq = LANDING_FAQ.find(f => /live advice/i.test(f.q));
    expect(coachFaq).toBeDefined();
    expect(coachFaq!.a).toMatch(/after-the-fact/i);
    expect(coachFaq!.a).toMatch(/never advises during live play/i);
  });

  it('stats section copy stays honest — never promises leaderboard imagery it does not show', () => {
    const stats = LANDING_SECTIONS.find(s => s.key === 'stats')!;
    expect(stats.body.toLowerCase()).not.toMatch(/leaderboard/);
  });

  it('premium bridge has an eyebrow + heading', () => {
    expect(LANDING_PREMIUM.eyebrow).toBe('PREMIUM');
    expect(LANDING_PREMIUM.heading.length).toBeGreaterThan(0);
  });

  it('derives both plans from PRICING with the yearly highlighted', () => {
    const plans = landingPlans();
    const monthly = plans.find(p => p.key === 'monthly')!;
    const yearly = plans.find(p => p.key === 'yearly')!;
    expect(monthly.price).toBe(PRICING.monthly.price);     // $8.99
    expect(yearly.price).toBe(PRICING.yearly.price);       // $79.99
    expect(monthly.productId).toBe(PRICING.monthly.productId);
    expect(yearly.productId).toBe(PRICING.yearly.productId);
    expect(yearly.highlighted).toBe(true);
    expect(monthly.highlighted).toBe(false);
    expect(yearly.subline).toMatch(/save 25%/);
  });

  it('benefits mirror the premium catalog in ANY posture — full passthrough, live-first', () => {
    // Structural, not numerical: stays green today (1 live / 3 Soon) AND after the
    // launch honesty flip (all live). The posture itself is pinned by honesty.test.ts.
    const benefits = landingBenefits();
    const catalog = PREMIUM_FEATURES.filter(f => !/advanced gto/i.test(f.title));
    expect(benefits).toHaveLength(catalog.length);
    const expectedLiveTitles = catalog
      .filter(f => !f.comingSoon)
      .map(f => (f.key === 'premium_study' ? PREMIUM_STUDY_BENEFIT : f.title));
    expect(benefits.filter(b => !b.comingSoon).map(b => b.title).sort()).toEqual(expectedLiveTitles.sort());
    const expectedSoonTitles = catalog.filter(f => f.comingSoon).map(f => f.title);
    expect(benefits.filter(b => b.comingSoon).map(b => b.title).sort()).toEqual(expectedSoonTitles.sort());
    // Live rows always render before Soon rows.
    const firstSoon = benefits.findIndex(b => b.comingSoon);
    if (firstSoon !== -1) expect(benefits.slice(firstSoon).every(b => b.comingSoon)).toBe(true);
  });

  it('post-flip simulation: after the honesty flip, every benefit renders live — nothing vanishes', () => {
    jest.isolateModules(() => {
      jest.doMock('../../premium/config', () => {
        const real = jest.requireActual('../../premium/config');
        return {
          ...real,
          PREMIUM_FEATURES: real.PREMIUM_FEATURES.map((f: { comingSoon: boolean }) => ({ ...f, comingSoon: false })),
          isFeatureLive: () => true,
        };
      });
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const flipped = require('../landingContent');
      const benefits = flipped.landingBenefits();
      expect(benefits.length).toBeGreaterThanOrEqual(3);
      expect(benefits.every((b: { comingSoon: boolean }) => !b.comingSoon)).toBe(true);
    });
    jest.dontMock('../../premium/config');
  });

  it('never advertises PACK-10 / Advanced GTO as paid value', () => {
    const titles = landingBenefits().map(b => b.title.toLowerCase());
    expect(titles.some(t => t.includes('advanced gto'))).toBe(false);
  });

  it('has FAQ entries with both question and answer', () => {
    expect(LANDING_FAQ.length).toBeGreaterThanOrEqual(3);
    LANDING_FAQ.forEach(f => {
      expect(f.q.length).toBeGreaterThan(0);
      expect(f.a.length).toBeGreaterThan(0);
    });
  });

  it('store links default to null (coming-soon pills) until the listings exist', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { STORE_LINKS } = require('../landingContent');
    expect(STORE_LINKS.appStoreUrl).toBeNull();
    expect(STORE_LINKS.playStoreUrl).toBeNull();
  });

  it('footer links to pricing + all three policies and shows the 18+/not-gambling disclaimer', () => {
    const hrefs = LANDING_LEGAL_LINKS.map(l => l.href);
    expect(hrefs).toContain('/pricing.html');
    expect(hrefs).toContain('/terms.html');
    expect(hrefs).toContain('/privacy.html');
    expect(hrefs).toContain('/refund.html');
    expect(LANDING_DISCLAIMER).toMatch(/18\+/);
    expect(LANDING_DISCLAIMER.toLowerCase()).toMatch(/not a gambling product/);
  });
});
