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
/** apps/poker-mobile/src/features/premium/__tests__ -> repo root is six levels up. */
const readRoot = (rel: string) => readFileSync(resolve(__dirname, '../../../../../..', rel), 'utf8');

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

describe('publisher identity — legal name Tay Shofer, not the trade name (locked 2026-07-23)', () => {
  // We submit under the owner's INDIVIDUAL developer account, so the seller / operator / copyright
  // entity on every legal surface is the legal name "Tay Shofer". "True Story Labs" may appear only
  // as the studio brand ("trading as True Story Labs", or in a contact label) — never as the party
  // you contract with or the copyright holder. See docs/release/store-submission-readiness.md.
  const legalPages: Record<string, string> = { terms, privacy, refund, pricing };

  it('every legal page copyright names Tay Shofer, never the trade name', () => {
    for (const html of Object.values(legalPages)) {
      expect(html).toMatch(/©\s*2026\s*Tay Shofer\s*·\s*T Poker/);
      expect(html).not.toMatch(/©\s*2026\s*True Story Labs/);
    }
  });

  it('terms / privacy / refund name Tay Shofer as the operator (first party, not the trade name)', () => {
    for (const html of [terms, privacy, refund]) {
      // Anchored so Tay Shofer must be the FIRST named party after "operated by" (only markup /
      // whitespace may sit between). A revert to "operated by True Story Labs…" fails this, while
      // the legitimate trailing "…, trading as True Story Labs" still passes.
      expect(html).toMatch(/operated by\s*(?:<strong>)?\s*Tay Shofer/);
    }
  });

  it('the binding clauses in the Terms bind you to Tay Shofer, not the trade name', () => {
    expect(terms).toMatch(/between you and Tay Shofer/);
    expect(terms).not.toMatch(/between you and True Story Labs/);
    expect(terms).not.toMatch(/True Story Labs will not be liable/);
    expect(terms).not.toMatch(/True Story Labs' principal place of business/);
  });

  it('the in-app © names Tay Shofer, not the trade name', () => {
    const profile = read('../src/screens/ProfileScreen.tsx');
    expect(profile).toMatch(/©\s*Tay Shofer/);
    expect(profile).not.toMatch(/©\s*True Story Labs/);
  });

  it('Profile credits the studio brand as a byline (Q1.6 7i), never as a copyright holder', () => {
    // "Made by True Story Labs" is a STUDIO credit, matching the byline already shown on the
    // splash, Welcome and Login screens — it is deliberately not "©", so it cannot make TSL read
    // as the rights-holder even if this line moves. The test above already pins that no © line in
    // this file names the trade name; this pins that the credit exists at all.
    const profile = read('../src/screens/ProfileScreen.tsx');
    expect(profile).toMatch(/Made by True Story Labs/);
  });

  it('the repo-root LICENSE names the legal copyright holder, not the git username placeholder (Q1.6b)', () => {
    // "tay123" is the GitHub username `create-github-repo` (or similar tooling) filled in by
    // default when the license was generated — never corrected. Same publisher-identity invariant
    // as every other surface in this describe block.
    const license = readRoot('LICENSE');
    expect(license).toMatch(/Copyright \(c\) 2026 Tay Shofer/);
    expect(license).not.toMatch(/tay123/);
  });
});

describe('repo-root PRIVACY.md — a pointer, not a second copy (Q1.6b)', () => {
  // The master plan's Q1.6 flagged this: PRIVACY.md at the repo root was a full DUPLICATE of
  // apps/poker-mobile/public/privacy.html (the page actually served at
  // https://app.tpoker.app/privacy.html), carrying its own "keep both in sync — the two must not
  // drift" comment. A comment asking a human to remember to keep two documents in sync is not a
  // guarantee — it is exactly the shape of claim this repo's standing rules say needs a test, and
  // there wasn't one. The fix removes the SECOND COPY rather than promising to maintain it: if
  // there is only one body of policy text, it cannot drift from itself.
  it('points at the canonical served page instead of restating the policy', () => {
    const privacyPointer = readRoot('PRIVACY.md');
    expect(privacyPointer).toMatch(/https:\/\/app\.tpoker\.app\/privacy\.html/);
  });

  it('does not duplicate the real policy\'s substantive body — that duplication was the drift risk', () => {
    // Structural, not just "shorter": these terms only belong in the ONE real policy. Their
    // presence here would mean the duplication grew back, whatever the file's line count says.
    const privacyPointer = readRoot('PRIVACY.md');
    expect(privacyPointer).not.toMatch(/PostHog/);
    expect(privacyPointer).not.toMatch(/bcrypt/);
    expect(privacyPointer).not.toMatch(/GDPR/);
    expect(privacyPointer).not.toMatch(/Railway/);
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
