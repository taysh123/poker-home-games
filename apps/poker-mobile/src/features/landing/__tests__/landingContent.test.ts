import { PRICING, PREMIUM_FEATURES } from '../../premium/config';
import {
  PREMIUM_STUDY_BENEFIT,
  LANDING_HERO,
  landingPlans,
  landingBenefits,
  LANDING_FAQ,
  LANDING_LEGAL_LINKS,
  LANDING_DISCLAIMER,
} from '../landingContent';

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

  it('derives both plans from PRICING with the yearly highlighted', () => {
    const plans = landingPlans();
    const monthly = plans.find(p => p.key === 'monthly')!;
    const yearly = plans.find(p => p.key === 'yearly')!;
    expect(monthly.price).toBe(PRICING.monthly.price);     // $11.99
    expect(yearly.price).toBe(PRICING.yearly.price);       // $99.99
    expect(monthly.productId).toBe(PRICING.monthly.productId);
    expect(yearly.productId).toBe(PRICING.yearly.productId);
    expect(yearly.highlighted).toBe(true);
    expect(monthly.highlighted).toBe(false);
    expect(yearly.subline).toMatch(/save 30%/);
  });

  it('lists exactly one live (non-Soon) paid benefit — Premium Study', () => {
    const benefits = landingBenefits();
    const live = benefits.filter(b => !b.comingSoon);
    expect(live).toHaveLength(1);
    expect(live[0].title).toBe(PREMIUM_STUDY_BENEFIT);
    expect(benefits.some(b => b.comingSoon)).toBe(true); // at least one honest Soon
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

  it('footer links to privacy + terms and shows the 18+/not-gambling disclaimer', () => {
    const hrefs = LANDING_LEGAL_LINKS.map(l => l.href);
    expect(hrefs).toContain('/privacy.html');
    expect(hrefs).toContain('/terms.html');
    expect(LANDING_DISCLAIMER).toMatch(/18\+/);
    expect(LANDING_DISCLAIMER.toLowerCase()).toMatch(/not a gambling product/);
  });
});
