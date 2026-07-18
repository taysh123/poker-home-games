/**
 * Canonical site constants. The app web build is the live product — all primary
 * CTAs link OUT to it (signup + Paddle billing live there).
 *
 * Domains (2026-07-16): marketing site = tpoker.app; app web build =
 * app.tpoker.app (the old poker-home-games-three.vercel.app 307-redirects there).
 * Policy pages ship inside the APP build's public/ dir, so they live on the app
 * domain — link them directly (no redirect hop for Paddle/SEO crawlers).
 */
export const SITE = {
  name: 'T Poker',
  appUrl: 'https://app.tpoker.app',
  /** This marketing site's own canonical origin (separate Vercel project; set NEXT_PUBLIC_SITE_URL in prod). */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://tpoker.app',
  contact: 'truestorylabs@gmail.com',
  company: 'True Story Labs',
  privacyUrl: 'https://app.tpoker.app/privacy.html',
  termsUrl: 'https://app.tpoker.app/terms.html',
} as const;
