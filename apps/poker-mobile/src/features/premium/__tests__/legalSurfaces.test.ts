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

describe('privacy.html — Paddle-consistent, stores intact', () => {
  it('names Paddle for web payments and does NOT mention Stripe', () => {
    expect(privacy).toMatch(/Paddle/);
    expect(privacy).not.toMatch(/\bStripe\b/i);
  });

  it('keeps the mobile processors (RevenueCat / Apple / Google) accurate', () => {
    expect(privacy).toMatch(/RevenueCat/);
    expect(privacy).toMatch(/Apple App Store/);
    expect(privacy).toMatch(/Google Play/);
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
