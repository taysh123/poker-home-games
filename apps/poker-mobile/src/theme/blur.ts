/**
 * Blur-intensity tokens for `GlassView` (iOS BlurView `intensity`). Real blur is
 * iOS-only; Android/web fall back to a solid surface, so these values only take
 * visible effect on iOS. `medium` (40) matches the historical GlassView default.
 *
 * subtle — faint frosting over content     medium — tab bar / action sheets
 * strong — full-screen modal backgrounds
 */
export const blur = {
  subtle: 20,
  medium: 40,
  strong: 70,
} as const;

export type BlurToken = keyof typeof blur;
