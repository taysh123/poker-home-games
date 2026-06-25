/** Responsive poker-felt sizing. The felt is CAPPED so it never stretches across a wide desktop,
 *  and uses a fixed ~1.6:1 elliptical aspect (height = width * 0.62). Pure + testable. */
export const MAX_TABLE_WIDTH = 760;       // felt never wider than this (desktop)
export const TABLE_ASPECT_RATIO = 0.62;   // height / width  → ~1.6:1 ellipse

export function tableDimensions(
  availableWidth: number,
  opts?: { maxWidth?: number; aspect?: number },
): { width: number; height: number } {
  const maxWidth = opts?.maxWidth ?? MAX_TABLE_WIDTH;
  const aspect = opts?.aspect ?? TABLE_ASPECT_RATIO;
  const width = Math.max(0, Math.min(availableWidth, maxWidth));
  return { width, height: Math.round(width * aspect) };
}