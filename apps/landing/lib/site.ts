/**
 * Canonical site constants. The app web build is the live product — all primary CTAs link OUT to
 * it. There is no billing anywhere: web payments were abandoned with the free-first pivot, and
 * nothing is purchasable in the app either.
 *
 * Domains (verified 2026-07-23, all resolving): marketing site = tpoker.app; app web build =
 * app.tpoker.app (the old poker-home-games-three.vercel.app 307-redirects there).
 * Policy pages ship inside the APP build's public/ dir, so they live on the app domain — link them
 * directly so crawlers and store reviewers don't take a redirect hop.
 */
export const SITE = {
  name: 'T Poker',
  appUrl: 'https://app.tpoker.app',
  /** This marketing site's own canonical origin (separate Vercel project; set NEXT_PUBLIC_SITE_URL in prod). */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://tpoker.app',
  contact: 'truestorylabs@gmail.com',
  // Legal rights-holder for the footer copyright. The app ships under the owner's individual
  // Apple Developer account, so the seller/copyright entity is the legal name, Tay Shofer —
  // NOT the "True Story Labs" brand (which stays as a studio byline inside the app).
  company: 'Tay Shofer',
  privacyUrl: 'https://app.tpoker.app/privacy.html',
  termsUrl: 'https://app.tpoker.app/terms.html',
} as const;
