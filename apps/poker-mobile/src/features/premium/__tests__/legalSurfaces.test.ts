/**
 * Legal-surface guards — keep the four public pages (pricing, terms, privacy, refund) present,
 * HONEST, and consistent with the free-first reality (slice 0.6, owner decision 2026-07-22):
 * nothing is purchasable anywhere, premium is "Coming soon", and when it launches payments run
 * through the app stores. Dead web-billing processors (Paddle as Merchant of Record, Stripe,
 * RevenueCat) must not be presented as live on ANY page. Cross-links + contact stay pinned.
 * Reads files directly (no React render) so it is fast and deterministic.
 *
 * NOTE: These pages are reasonable working drafts based on standard SaaS practice — they are
 * guarded for presence/consistency here, not certified as legally airtight. Have Terms + Refund
 * reviewed by a qualified professional before taking real payments.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (rel: string) => readFileSync(resolve(__dirname, '../../../../public', rel), 'utf8');

const terms = read('terms.html');
const privacy = read('privacy.html');
const pricing = read('pricing.html');
const refund = read('refund.html');

/** Every public legal/commerce page must cross-link all four from its footer. */
function expectLinksAllFourPages(html: string) {
  expect(html).toMatch(/\/pricing\.html/);
  expect(html).toMatch(/\/terms\.html/);
  expect(html).toMatch(/\/privacy\.html/);
  expect(html).toMatch(/\/refund\.html/);
}

describe('terms.html — binding Terms of Service (no draft scaffolding)', () => {
  it('is NOT presented as a non-binding draft', () => {
    expect(terms).not.toMatch(/PENDING LEGAL REVIEW/i);
    expect(terms).not.toMatch(/\[counsel-owned\]/i);
    expect(terms).not.toMatch(/not yet (in effect|binding)/i);
    expect(terms).not.toMatch(/\bdraft\b/i);
    expect(terms).not.toMatch(/supersedes this draft/i);
  });

  it('free-first honest: nothing purchasable, no dead web processors, no hardcoded prices', () => {
    expect(terms).toMatch(/nothing can be purchased|nothing is (currently )?purchasable/i);
    expect(terms).toMatch(/Coming soon/);
    expect(terms).not.toMatch(/\bPaddle\b/);
    expect(terms).not.toMatch(/\bStripe\b/i);
    expect(terms).not.toMatch(/\bRevenueCat\b/);
    expect(terms).not.toMatch(/Merchant of Record/i);
    expect(terms).not.toMatch(/\$\d+\.\d{2}/); // prices are announced at launch, not pinned here
  });

  it('names the future app-store billing path with the platform disclosures', () => {
    expect(terms).toMatch(/Apple App Store/);
    expect(terms).toMatch(/Google Play/);
    expect(terms).toMatch(/auto-renew/i);
    expect(terms).toMatch(/cancel/i);
  });

  it('carries the eligibility + contact disclosures', () => {
    expect(terms).toMatch(/18 and older/i);
    expect(terms).toMatch(/truestorylabs@gmail\.com/);
  });

  it('does not falsely claim real-money gambling', () => {
    expect(terms).toMatch(/not.*real-money gambling/i);
  });

  it('links out to the Refund Policy and cross-links all four pages', () => {
    expect(terms).toMatch(/\/refund\.html/);
    expectLinksAllFourPages(terms);
  });
});

describe('privacy.html — free-first honest + consent-scoped analytics (Wave 0.2)', () => {
  // Deliberate re-pin (owner decision 5, 2026-07-22): Paddle web billing is dead (rejected poker);
  // the policy now states nothing is purchasable and names the future app-store processors only.
  it('states nothing is purchasable and does NOT name dead web processors', () => {
    expect(privacy).toMatch(/currently purchasable|cannot be bought/i);
    expect(privacy).toMatch(/Coming soon/);
    expect(privacy).not.toMatch(/\bPaddle\b/);
    expect(privacy).not.toMatch(/\bStripe\b/i);
    expect(privacy).not.toMatch(/\bRevenueCat\b/);
    expect(privacy).not.toMatch(/Merchant of Record/i);
  });

  it('names the future app-store processors', () => {
    expect(privacy).toMatch(/Apple App Store/);
    expect(privacy).toMatch(/Google Play/);
  });

  it('discloses consent-scoped anonymous analytics: PostHog, EU, opt-out, and the exclusions', () => {
    expect(privacy).toMatch(/PostHog/);
    expect(privacy).toMatch(/European Union/);
    expect(privacy).toMatch(/after you make your explicit\s+choice on the\s+welcome screen/i);
    expect(privacy).toMatch(/Profile → Privacy/);
    // The never-collected list must stay explicit — game amounts / player names / hands.
    expect(privacy).toMatch(/never include.*game amounts/is);
    expect(privacy).toMatch(/player names/);
    expect(privacy).toMatch(/hand contents/);
  });

  it('scopes the guest guarantee to GAME data (analytics is disclosed separately)', () => {
    expect(privacy).toMatch(/game data stays on your device/i);
    expect(privacy).toMatch(/Guest-mode game data never reaches our servers/i);
    expect(privacy).toMatch(/Local guest game data never leaves\s+your device/i);
  });

  it('has a contact address and cross-links all four pages', () => {
    expect(privacy).toMatch(/truestorylabs@gmail\.com/);
    expectLinksAllFourPages(privacy);
  });
});

describe('pricing.html — free-first honest (nothing purchasable)', () => {
  it('free plan is $0 and the premium plan shows NO price and NO purchase CTA', () => {
    expect(pricing).toMatch(/\$0/);
    expect(pricing).toMatch(/Coming soon/);
    expect(pricing).toMatch(/cannot be purchased|Nothing is currently purchasable/i);
    // The only dollar amount on the page is the free plan's $0 — no premium pricing exists yet.
    expect(pricing).not.toMatch(/\$\d+\.\d{2}/);
    expect(pricing).not.toMatch(/Get Premium/i);
    expect(pricing).toMatch(/no checkout/i); // the page states the absence explicitly
  });

  it('names no dead web processor and no Merchant of Record', () => {
    expect(pricing).not.toMatch(/\bPaddle\b/);
    expect(pricing).not.toMatch(/\bStripe\b/i);
    expect(pricing).not.toMatch(/\bRevenueCat\b/);
    expect(pricing).not.toMatch(/Merchant of Record/i);
  });

  it('names the future app-store path and cross-links all four pages', () => {
    expect(pricing).toMatch(/Apple App Store/);
    expect(pricing).toMatch(/Google Play/);
    expectLinksAllFourPages(pricing);
  });
});

describe('refund.html — free-first honest refund/cancellation policy', () => {
  it('states nothing is purchasable today and still describes future refunds/cancellation', () => {
    expect(refund).toMatch(/nothing can be bought|Nothing is currently purchasable/i);
    expect(refund).toMatch(/refund/i);
    expect(refund).toMatch(/cancel/i);
  });

  it('routes future purchases through the stores only — no dead web processors', () => {
    expect(refund).toMatch(/Apple|App Store/);
    expect(refund).toMatch(/Google Play/);
    expect(refund).not.toMatch(/\bPaddle\b/);
    expect(refund).not.toMatch(/\bStripe\b/i);
    expect(refund).not.toMatch(/\bRevenueCat\b/);
  });

  it('cross-links all four pages', () => {
    expectLinksAllFourPages(refund);
  });
});

describe('Terms link presence in-app', () => {
  it('is linked from the Paywall screen', () => {
    expect(read('../src/features/premium/ui/PaywallScreen.tsx')).toMatch(/terms\.html/);
  });

  it('is linked from the Profile screen', () => {
    expect(read('../src/screens/ProfileScreen.tsx')).toMatch(/terms\.html/);
  });
});
