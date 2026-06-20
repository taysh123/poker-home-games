import { seatPositions, pointToward } from '../seatLayout';

const BOX = { width: 300, height: 200 };

describe('seatPositions', () => {
  it('returns no seats for non-positive counts', () => {
    expect(seatPositions(0, BOX)).toEqual([]);
    expect(seatPositions(-3, BOX)).toEqual([]);
  });

  it('returns exactly `count` seats', () => {
    expect(seatPositions(6, BOX)).toHaveLength(6);
  });

  it('places the hero (index 0) at bottom-center', () => {
    const [hero] = seatPositions(6, BOX);
    expect(hero.x).toBeCloseTo(BOX.width / 2, 5);
    expect(hero.y).toBeGreaterThan(BOX.height / 2); // below center
  });

  it('keeps all seats within the table box', () => {
    for (const p of seatPositions(9, BOX)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(BOX.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(BOX.height);
    }
  });

  it('places the second of two seats at top-center (opposite hero)', () => {
    const [, top] = seatPositions(2, BOX);
    expect(top.x).toBeCloseTo(BOX.width / 2, 5);
    expect(top.y).toBeLessThan(BOX.height / 2); // above center
  });
});

describe('pointToward', () => {
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 20 };
  it('returns the start at t=0 and the end at t=1', () => {
    expect(pointToward(from, to, 0)).toEqual({ x: 0, y: 0 });
    expect(pointToward(from, to, 1)).toEqual({ x: 10, y: 20 });
  });
  it('interpolates linearly at the midpoint', () => {
    expect(pointToward(from, to, 0.5)).toEqual({ x: 5, y: 10 });
  });
});
