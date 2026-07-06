/**
 * Landing product screenshots — WEB implementation (Metro `.web.ts` resolution).
 * Fresh captures from the production export (guest mode, current UI, ₪, 780×1688).
 * Regenerate via %TEMP%\tpoker-verify\capture-landing-assets.js after visual changes.
 */
export type LandingImageKey = 'liveCash' | 'settle' | 'finalCount' | 'tournament' | 'stats';

/** Captured at 390×844 CSS @2x — every landing shot shares this aspect ratio. */
export const LANDING_IMAGE_WIDTH = 780;
export const LANDING_IMAGE_HEIGHT = 1688;

export const landingImages: Partial<Record<LandingImageKey, number>> = {
  liveCash: require('../../../assets/landing/live-cash.png'),
  settle: require('../../../assets/landing/settle.png'),
  finalCount: require('../../../assets/landing/final-count.png'),
  tournament: require('../../../assets/landing/tournament.png'),
  stats: require('../../../assets/landing/stats.png'),
};
