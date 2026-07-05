/**
 * BrandSplash timeline (product decision 2026-07-05): a ~1.2s single-brand
 * moment on every cold start — logo in, wordmark rises, tagline breathes,
 * then the whole overlay fades out revealing the app. Always skippable.
 *
 * All values in ms. Pinned by __tests__/splashTimeline.test.ts so future
 * tweaks stay inside the approved envelope (total <= 1.3s, exit < enter,
 * reduced-motion static frame <= 0.8s).
 */
export const SPLASH = {
  /** Logo badge: opacity in + spring scale 0.92 -> 1, from t=0. */
  LOGO_IN: 320,
  /** "T POKER" wordmark: fade + 8px rise. */
  WORD_DELAY: 120,
  WORD_IN: 340,
  /** Tagline + byline: quiet fade. */
  TAG_DELAY: 280,
  TAG_IN: 280,
  /** When the overlay starts fading out (hold ends). */
  EXIT_AT: 900,
  /** Overlay fade-out — deliberately faster than the enter block. */
  EXIT: 300,
  /** Full animated path: EXIT_AT + EXIT. */
  TOTAL: 1200,
  /** Reduced motion: static composed frame shown for this long, then done. */
  REDUCED_HOLD: 600,
  /** Tap-to-skip: fast fade so the app answers the tap immediately. */
  SKIP_EXIT: 180,
} as const;

/** Effective duration/exit pair for the active motion mode. */
export function splashDurations(reduced: boolean): { total: number; exit: number } {
  return reduced ? { total: SPLASH.REDUCED_HOLD, exit: 0 } : { total: SPLASH.TOTAL, exit: SPLASH.EXIT };
}
