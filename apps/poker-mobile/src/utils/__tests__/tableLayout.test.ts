import { tableDimensions, MAX_TABLE_WIDTH, TABLE_ASPECT_RATIO } from '../tableLayout';

describe('tableDimensions', () => {
  it('mobile width (335) returns exact width with no cap', () => {
    const result = tableDimensions(335);
    expect(result.width).toBe(335);
    expect(result.height).toBe(Math.round(335 * TABLE_ASPECT_RATIO));
  });

  it('wide desktop width (1880) caps to MAX_TABLE_WIDTH', () => {
    const result = tableDimensions(1880);
    expect(result.width).toBe(MAX_TABLE_WIDTH);
    expect(result.height).toBe(Math.round(MAX_TABLE_WIDTH * TABLE_ASPECT_RATIO));
  });

  it('exactly MAX_TABLE_WIDTH is unchanged', () => {
    const result = tableDimensions(MAX_TABLE_WIDTH);
    expect(result.width).toBe(MAX_TABLE_WIDTH);
    expect(result.height).toBe(Math.round(MAX_TABLE_WIDTH * TABLE_ASPECT_RATIO));
  });

  it('honors custom aspect override', () => {
    const result = tableDimensions(400, { aspect: 0.86 });
    expect(result.width).toBe(400);
    expect(result.height).toBe(Math.round(400 * 0.86));
  });

  it('0 availableWidth returns width 0', () => {
    const result = tableDimensions(0);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it('negative availableWidth returns width 0', () => {
    const result = tableDimensions(-50);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it('result.width never exceeds maxWidth', () => {
    const result = tableDimensions(9999, { maxWidth: 500 });
    expect(result.width).toBeLessThanOrEqual(500);
  });

  it('honors custom maxWidth option', () => {
    const result = tableDimensions(9999, { maxWidth: 600 });
    expect(result.width).toBe(600);
  });
});