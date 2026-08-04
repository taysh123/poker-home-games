/**
 * App-store badge config. `href` is present ONLY for a store where the app has genuinely
 * shipped — badges without one render disabled ("Coming soon"), badges with one render as real
 * links. The honesty test enforces this per-badge, not blanket: T Poker 1.1.1 is live on the App
 * Store (owner-verified URL, never regenerate it), Android has no listing yet.
 */
export type StoreBadge = {
  key: 'app_store' | 'google_play';
  /** Wordmark, e.g. "App Store". */
  label: string;
  /** Small lead-in line, e.g. "Download on the". */
  caption: string;
  /** Present ⇒ this store listing is LIVE and the badge is a real link. */
  href?: string;
};

export const STORE_BADGES: StoreBadge[] = [
  {
    key: 'app_store',
    label: 'App Store',
    caption: 'Download on the',
    href: 'https://apps.apple.com/app/t-poker-poker-trainer/id6781109023',
  },
  { key: 'google_play', label: 'Google Play', caption: 'Get it on' },
];
