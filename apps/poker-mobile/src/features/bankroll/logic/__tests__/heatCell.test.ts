import {
  heatCellVisual, heatCellStyle, heatCellTextColor, dayCellLabel,
} from '../heatCell';
import { colors } from '../../../../theme/colors';
import type { DayHeatLevel } from '../calendar';

const bucket = (level: number, netCents: number, sessionCount = 1): DayHeatLevel =>
  ({ dayKey: '2026-06-03', sessionCount, netCents, level });

describe('heatCellVisual — the four states', () => {
  it('no bucket at all is "none"', () => {
    expect(heatCellVisual(undefined)).toEqual({ kind: 'none', step: 0 });
  });

  it('a played but break-even day is "even", NOT "none"', () => {
    // The distinction that matters: "I did not play" vs "I played and finished flat".
    expect(heatCellVisual(bucket(0, 0))).toEqual({ kind: 'even', step: 0 });
  });

  it('positive levels are "win" and negative are "loss", at their magnitude step', () => {
    expect(heatCellVisual(bucket(4, 10000))).toEqual({ kind: 'win', step: 4 });
    expect(heatCellVisual(bucket(1, 100))).toEqual({ kind: 'win', step: 1 });
    expect(heatCellVisual(bucket(-4, -10000))).toEqual({ kind: 'loss', step: 4 });
    expect(heatCellVisual(bucket(-2, -500))).toEqual({ kind: 'loss', step: 2 });
  });

  it('clamps a step above the ramp so a style lookup can never fall off the end', () => {
    expect(heatCellVisual(bucket(9, 99999), 4)).toEqual({ kind: 'win', step: 4 });
    expect(heatCellVisual(bucket(-9, -99999), 4)).toEqual({ kind: 'loss', step: 4 });
  });
});

describe('THE B4 PIN: sign never depends on colour alone', () => {
  it('mirrored magnitudes differ by KIND, not just by hue', () => {
    // Grayscale the app and a +400 day must still be tellable from a -400 day.
    for (const step of [1, 2, 3, 4]) {
      const win = heatCellVisual(bucket(step, 400));
      const loss = heatCellVisual(bucket(-step, -400));
      expect(win.kind).not.toBe(loss.kind);
      expect(win.step).toBe(loss.step);
    }
  });

  it('losing cells are HOLLOW — never a solid fill, at any intensity', () => {
    for (const step of [1, 2, 3, 4]) {
      const style = heatCellStyle(heatCellVisual(bucket(-step, -400)));
      expect(style.backgroundColor).toBe('transparent');
      expect(style.borderWidth).toBeGreaterThanOrEqual(2);
    }
  });

  it('winning cells are FILLED — a real background at every intensity', () => {
    for (const step of [1, 2, 3, 4]) {
      const style = heatCellStyle(heatCellVisual(bucket(step, 400)));
      expect(style.backgroundColor).not.toBe('transparent');
    }
  });

  it('all four kinds are visually distinct from each other', () => {
    const styles = [
      heatCellStyle(heatCellVisual(undefined)),
      heatCellStyle(heatCellVisual(bucket(0, 0))),
      heatCellStyle(heatCellVisual(bucket(2, 400))),
      heatCellStyle(heatCellVisual(bucket(-2, -400))),
    ].map(s => `${s.backgroundColor}|${s.borderColor}|${s.borderWidth}`);
    expect(new Set(styles).size).toBe(4);
  });

  it('the win ramp strengthens monotonically and ends on solid gold', () => {
    const fills = [1, 2, 3, 4].map(s => heatCellStyle(heatCellVisual(bucket(s, 400))).backgroundColor);
    expect(new Set(fills).size).toBe(4);      // four distinguishable steps
    expect(fills[3]).toBe(colors.gold);
  });
});

describe('heatCellTextColor', () => {
  it('flips to the dark background token on the solid-gold top step', () => {
    // White-on-gold fails contrast; the top step is the only opaque fill.
    expect(heatCellTextColor(heatCellVisual(bucket(4, 10000)))).toBe(colors.background);
  });

  it('stays light on every translucent or hollow cell', () => {
    expect(heatCellTextColor(heatCellVisual(bucket(1, 100)))).toBe(colors.textHigh);
    expect(heatCellTextColor(heatCellVisual(bucket(-4, -10000)))).toBe(colors.textHigh);
    expect(heatCellTextColor(heatCellVisual(bucket(0, 0)))).toBe(colors.textMuted);
    expect(heatCellTextColor(heatCellVisual(undefined))).toBe(colors.textDim);
  });
});

describe('dayCellLabel — spoken name matches what is drawn', () => {
  it('names an unplayed day without implying a result', () => {
    expect(dayCellLabel('2026-06-03', 3, undefined)).toBe('June 3, no session');
  });

  it('says break-even explicitly rather than reading as nothing', () => {
    expect(dayCellLabel('2026-06-03', 3, bucket(0, 0))).toBe('June 3, broke even, 1 session');
  });

  it('states the signed amount and pluralises sessions', () => {
    // formatCents drops a zero fraction for ILS: 84000 -> "₪840", not "₪840.00".
    expect(dayCellLabel('2026-06-03', 3, bucket(3, 84000))).toBe('June 3, up ₪840, 1 session');
    expect(dayCellLabel('2026-06-03', 3, bucket(-2, -45000, 2))).toBe('June 3, down ₪450, 2 sessions');
  });

  it('keeps a fractional amount intact', () => {
    expect(dayCellLabel('2026-06-03', 3, bucket(1, 5050))).toBe('June 3, up ₪50.50, 1 session');
  });
});
