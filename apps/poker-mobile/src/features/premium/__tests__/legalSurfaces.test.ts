/**
 * Legal-surface guards — keep the commercial/legal surfaces present, honest, and consistent
 * with the live billing setup (Paddle is the web Merchant of Record; RevenueCat/App Store/
 * Google Play on mobile). The four public pages — pricing, terms, privacy, refund — must exist,
 * carry the required subscription disclosures, drop the old counsel-owned DRAFT scaffolding, and
 * cross-link each other from a footer so Paddle's reviewer (and users) can find them.
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

  it('names Paddle as the web Merchant of Record and does NOT mention Stripe', () => {
    expect(terms).toMatch(/Paddle/);
    expect(terms).toMatch(/Merchant of Record/i);
    expect(terms).not.toMatch(/\bStripe\b/i);
  });

  it('keeps the $8.99 / $79.99 prices', () => {
    expect(terms).toMatch(/\$8\.99/);
    expect(terms).toMatch(/\$79\.99/);
  });

  it('carries the subscription / auto-renew / eligibility / contact disclosures', () => {
    expect(terms).toMatch(/auto-renew/i);
    expect(terms).toMatch(/cancel/i);
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

describe('pricing.html — public prices Paddle can verify', () => {
  it('shows both plan prices and the yearly savings', () => {
    expect(pricing).toMatch(/\$8\.99/);
    expect(pricing).toMatch(/\$79\.99/);
    expect(pricing).toMatch(/\$6\.67/);
    expect(pricing).toMatch(/save 25%/i);
  });

  it('names Paddle as the web processor and does NOT mention Stripe', () => {
    expect(pricing).toMatch(/Paddle/);
    expect(pricing).not.toMatch(/\bStripe\b/i);
  });

  it('cross-links all four pages', () => {
    expectLinksAllFourPages(pricing);
  });
});

describe('refund.html — refund/cancellation policy present', () => {
  it('describes refunds and cancellation', () => {
    expect(refund).toMatch(/refund/i);
    expect(refund).toMatch(/cancel/i);
  });

  it('routes web refunds through Paddle and mobile through the stores, no Stripe', () => {
    expect(refund).toMatch(/Paddle/);
    expect(refund).toMatch(/Apple|App Store/);
    expect(refund).toMatch(/Google Play/);
    expect(refund).not.toMatch(/\bStripe\b/i);
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
