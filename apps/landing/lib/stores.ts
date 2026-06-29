/**
 * App-store badge config. These are intentionally NOT links — the mobile apps
 * are not shipped yet, so the data carries NO `href`. The honesty test asserts
 * this, and `StoreBadges` renders them disabled ("Coming soon").
 */
export type StoreBadge = {
  key: 'app_store' | 'google_play';
  /** Wordmark, e.g. "App Store". */
  label: string;
  /** Small lead-in line, e.g. "Download on the". */
  caption: string;
};

export const STORE_BADGES: StoreBadge[] = [
  { key: 'app_store', label: 'App Store', caption: 'Download on the' },
  { key: 'google_play', label: 'Google Play', caption: 'Get it on' },
];
