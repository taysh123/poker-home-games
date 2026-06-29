/**
 * Seat geometry for the immersive poker table (V2.1 STEP 5.3) — PURE + testable. Distributes `count`
 * seats evenly around an ellipse, with the hero (index 0) at bottom-center. Coordinates are the seat
 * CENTERS in the table's local px space.
 */
export interface Point { x: number; y: number }

export function seatPositions(
  count: number,
  opts: { width: number; height: number; inset?: number },
): Point[] {
  const { width, height, inset = 0.82 } = opts;
  if (count <= 0) return [];
  const cx = width / 2;
  const cy = height / 2;
  const rx = (width / 2) * inset;
  const ry = (height / 2) * inset;
  return Array.from({ length: count }, (_, i) => {
    // i=0 → +90° → bottom-center (hero); subsequent seats go clockwise around the ellipse.
    const angle = Math.PI / 2 + (2 * Math.PI * i) / count;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

/**
 * Point a fraction `t` (0..1) of the way from `from` toward `to`. Used to place a seat's committed
 * "bet chip" partway between the seat and the table center. PURE.
 */
export function pointToward(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
