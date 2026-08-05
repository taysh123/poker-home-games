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
/** In-app copy is a legal surface too — the deletion dialog is where consent actually happens. */
const readSrc = (rel: string) => readFileSync(resolve(__dirname, '../../..', rel), 'utf8');

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
    // PIN REWRITTEN 2026-08-05, deliberately — the sentence it guarded was imprecise.
    //   OLD: /after you make your explicit\s+choice on the\s+welcome screen/i
    //        — guarded "Collection begins only after you make your explicit choice on the welcome
    //          screen", which contradicted the code: `welcome_shown` (and the choice event itself)
    //          are tracked BEFORE consent, buffered, and transmitted once the choice is made.
    //   NEW: the three clauses that make the replacement TRUE — nothing sent pre-choice, the
    //        welcome-screen events are held on the device until then, and they are discarded and
    //        never leave the device if the user never chooses.
    // Pinning the guarantees rather than one phrase, so a future reword can change the prose but
    // not quietly drop a clause (the T0.5 lesson: ban/assert the claim, not the wording).
    expect(privacy).toMatch(/Nothing is sent before you make your choice/i);
    expect(privacy).toMatch(/held on your device until then/i);
    expect(privacy).toMatch(/discarded and never leave your device/i);
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

  it('the deletion SECTION claims no completeness, in any wording', () => {
    // The first version of this pin banned two literal phrases and was trivially evaded: a review
    // rewrote the paragraph to "erases every piece of personal information we hold about you,
    // leaving nothing behind" — a claim proven false by execution — and all 30 tests stayed green.
    // A ban on one verb is not a ban on the claim.
    //
    // So: scope to the deletion section and ban the SEMANTIC class — any (erase|delete|remove|wipe)
    // near an everything/nothing-left quantifier. Sentences that enumerate what goes ("removes your
    // profile and login credentials") do not match, which is the distinction that matters.
    const section = privacy.slice(privacy.indexOf('id="delete"'));
    const deletion = section.slice(0, section.indexOf('<h2', 1));

    expect(deletion).not.toMatch(
      /(eras|delet|remov|wip)\w*[^.]{0,80}(everything|all (your |the |associated )*(personal )?(data|information)|nothing[^.]{0,30}(left|behind|kept|remains))/i,
    );
  });

  it('does NOT promise that deletion removes everything', () => {
    // The old text promised deletion removes "your account and all associated personal data
    // (profile, game records, …) from our servers, immediately". Every part of that was
    // contradicted by DeleteAccountCommandHandler: game records SURVIVE by design (they are the
    // other players' record of a shared night), display names survive in the activity feed, hand
    // records and delivered notifications, and several account identifiers had no modelled FK so
    // nothing ever cleared them (audit 2026-08-03, HIGH #5).
    //
    // Banned as PHRASES, not by asserting the replacement wording, so a future rewrite is free to
    // reword but cannot re-promise completeness.
    expect(privacy).not.toMatch(/all associated personal data/i);
    expect(privacy).not.toMatch(/removes?[^.]{0,40}\ball\b[^.]{0,40}\bdata\b/i);
  });

  it('states the real deletion scope: what goes, what stays, and why', () => {
    // What genuinely goes.
    expect(privacy).toMatch(/profile and login credentials/i);
    expect(privacy).toMatch(/settlement records that name you/i);
    // What genuinely stays — the three survivor classes, each true of the shipped handler.
    // \s+ between words: the source HTML hard-wraps, so a phrase can straddle a line break.
    expect(privacy).toMatch(/disconnected\s+from\s+your\s+account/i);        // seat + amounts anonymised
    expect(privacy).toMatch(/display\s+name\s+can\s+still\s+appear/i);       // ActorName / WinnerName / notifications
    expect(privacy).toMatch(/keep\s+an\s+internal\s+identifier/i);           // Session.CreatorId et al, no modelled FK
  });

  it('the IN-APP deletion copy makes the same promise as this page', () => {
    // The policy page is the reference; the confirm dialog is the CONSENT. Rewriting only the page
    // left the app still promising "all associated data" at the exact moment the user taps Delete —
    // and every gate stayed green, because this file only ever read privacy.html. The in-app strings
    // are the more load-bearing surface for App Store 5.1.1(v), so they are pinned here too.
    const profile = readSrc('screens/ProfileScreen.tsx');

    expect(profile).not.toMatch(/all (associated|your) data/i);
    expect(profile).not.toMatch(
      /(eras|delet|remov|wip)\w*[^'"]{0,60}(everything|all (your |the |associated )*(personal )?(data|information))/i,
    );
    // ...and it states the survivor class rather than staying silent about it.
    expect(profile).toMatch(/stay for the\s+other players/i);
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

  it('names Tay Shofer, not the trade name, as copyright holder — same invariant as every other legal surface', () => {
    // A fleet caught this gap: the "publisher identity" describe block above pins terms/privacy/
    // pricing/refund.html, ProfileScreen.tsx, and this file's own LICENSE, but not PRIVACY.md's
    // own new copyright line — the exact invariant this commit is supposed to protect had a silent
    // hole in the one file it just rewrote.
    const privacyPointer = readRoot('PRIVACY.md');
    expect(privacyPointer).toMatch(/©\s*2026\s*Tay Shofer\s*·\s*T Poker/);
    expect(privacyPointer).not.toMatch(/©\s*True Story Labs/);
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
