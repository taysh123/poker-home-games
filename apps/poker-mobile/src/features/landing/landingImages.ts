/**
 * Landing product screenshots — NATIVE stub.
 *
 * The landing page is web-only (LandingScreen returns null on native), so the
 * ~650KB of section screenshots must never ship inside the iOS/Android binaries.
 * Metro resolves `landingImages.web.ts` on web (real requires) and this empty
 * stub on native — a static `require` here would be bundled unconditionally.
 */
export type LandingImageKey = 'liveCash' | 'settle' | 'finalCount' | 'tournament' | 'stats';

/** Captured at 390×844 CSS @2x — every landing shot shares this aspect ratio. */
export const LANDING_IMAGE_WIDTH = 780;
export const LANDING_IMAGE_HEIGHT = 1688;

export const landingImages: Partial<Record<LandingImageKey, number>> = {};
