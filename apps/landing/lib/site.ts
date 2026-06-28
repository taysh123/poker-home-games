/**
 * Canonical site constants. The app web build is the live product — all primary
 * CTAs link OUT to it (signup + Paddle billing live there).
 */
export const SITE = {
  name: 'T Poker',
  appUrl: 'https://poker-home-games-three.vercel.app',
  /** This marketing site's own canonical origin (separate Vercel project; set NEXT_PUBLIC_SITE_URL in prod). */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://tpoker-landing.vercel.app',
  contact: 'truestorylabs@gmail.com',
  company: 'True Story Labs',
  privacyUrl: 'https://poker-home-games-three.vercel.app/privacy.html',
  termsUrl: 'https://poker-home-games-three.vercel.app/terms.html',
} as const;
