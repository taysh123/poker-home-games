import {
  heatCellVisual, heatCellStyle, heatCellTextColor, dayCellLabel, RAMP_STEPS,
} from '../heatCell';
import { colors } from '../../../../theme/colors';
import type { DayHeatLevel } from '../calendar';

const bucket = (level: number, netCents: number, sessionCount = 1): DayHeatLevel =>
  ({ dayKey: '2026-06-03', sessionCount, netCents, level });

// ── WCAG contrast, computed rather than eyeballed ────────────────────────────────────────────
// The first version of this encoding shipped a ramp whose bottom three win steps measured
// 1.13:1, 1.29:1 and 2.27:1, and dimmed the two smallest loss rings to 1.54:1 — i.e. the shape
// channel the B4 decision rests on was invisible on most played days. These helpers make the
// contrast an assertion instead of an assumption.
const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** Parse '#RRGGBB' or 'rgba(r,g,b,a)' into [r,g,b,a]. */
const parseColor = (value: string): [number, number, number, number] => {
  const rgba = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const parts = rgba[1].split(',').map(p => Number(p.trim()));
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
    1,
  ];
};

/** Contrast ratio of `fg` (alpha-composited over `bg`) against `bg`. */
const contrast = (fg: string, bg: string): number => {
  const [fr, fg_, fb, fa] = parseColor(fg);
  const [br, bg_, bb] = parseColor(bg);
  const composited = [fr * fa + br * (1 - fa), fg_ * fa + bg_ * (1 - fa), fb * fa + bb * (1 - fa)];
  const [hi, lo] = [luminance(composited), luminance([br, bg_, bb])].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

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
    // `heatmapLevels` bands to 1..4, so an out-of-range level means a hand-built bucket. Even
    // then it must not index off the ramp: an undefined style renders a LOSS identically to a
    // no-session day, the exact sign-collapse this module exists to prevent.
    for (const level of [5, 6, 10]) {
      const win = heatCellStyle(heatCellVisual(bucket(level, 99999)));
      const loss = heatCellStyle(heatCellVisual(bucket(-level, -99999)));
      expect(win.backgroundColor).toBeDefined();
      expect(loss.borderColor).toBeDefined();
      expect(loss.borderWidth).toBeGreaterThan(0);
      expect(loss.borderWidth).not.toBeNaN();
    }
    expect(heatCellVisual(bucket(10, 99999))).toEqual({ kind: 'win', step: RAMP_STEPS });
    expect(heatCellVisual(bucket(-10, -99999))).toEqual({ kind: 'loss', step: RAMP_STEPS });
  });
});

describe('CONTRAST: the shape channel has to be visible to be a channel', () => {
  const BACKDROP = colors.background;

  it('every win fill clears the 3:1 non-text floor against the backdrop', () => {
    for (const step of [1, 2, 3, 4]) {
      const { backgroundColor } = heatCellStyle(heatCellVisual(bucket(step, 400)));
      expect(contrast(backgroundColor, BACKDROP)).toBeGreaterThanOrEqual(3);
    }
  });

  it('every loss ring clears the 3:1 non-text floor — including the smallest loss', () => {
    for (const step of [1, 2, 3, 4]) {
      const { borderColor } = heatCellStyle(heatCellVisual(bucket(-step, -400)));
      expect(contrast(borderColor, BACKDROP)).toBeGreaterThanOrEqual(3);
    }
  });

  it("the break-even ring is visible, so the third state isn't carried by text colour alone", () => {
    const { borderColor } = heatCellStyle(heatCellVisual(bucket(0, 0)));
    expect(contrast(borderColor, BACKDROP)).toBeGreaterThanOrEqual(3);
  });

  it('the day number clears the 4.5:1 text floor in every state, including unplayed days', () => {
    // Unplayed days are the MAJORITY of cells in a normal month; textDim measured 1.95:1 here.
    const onBackdrop = [
      heatCellTextColor(heatCellVisual(undefined)),
      heatCellTextColor(heatCellVisual(bucket(0, 0))),
      heatCellTextColor(heatCellVisual(bucket(-3, -400))), // hollow: text sits on the backdrop
    ];
    for (const color of onBackdrop) {
      expect(contrast(color, BACKDROP)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the day number clears 4.5:1 against its own win fill at every step', () => {
    for (const step of [1, 2, 3, 4]) {
      const visual = heatCellVisual(bucket(step, 400));
      const fill = heatCellStyle(visual).backgroundColor;
      // Composite the fill over the backdrop first — that is what the text actually sits on.
      const [r, g, b, a] = parseColor(fill);
      const [br, bg, bb] = parseColor(BACKDROP);
      const solidFill = `#${[r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)]
        .map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
      expect(contrast(heatCellTextColor(visual), solidFill)).toBeGreaterThanOrEqual(4.5);
    }
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
  it('inverts to the dark token from win step 2 up, where the fill is too light for light text', () => {
    expect(heatCellTextColor(heatCellVisual(bucket(2, 5000)))).toBe(colors.background);
    expect(heatCellTextColor(heatCellVisual(bucket(3, 8000)))).toBe(colors.background);
    expect(heatCellTextColor(heatCellVisual(bucket(4, 10000)))).toBe(colors.background);
  });

  it('stays light on the faintest win fill and on every hollow cell', () => {
    expect(heatCellTextColor(heatCellVisual(bucket(1, 100)))).toBe(colors.textHigh);
    expect(heatCellTextColor(heatCellVisual(bucket(-4, -10000)))).toBe(colors.textHigh);
  });

  it('uses a READABLE muted token for unplayed and break-even days, never textDim', () => {
    // textDim (#3A4A5A) measures 1.95:1 on the backdrop and these are most of the month.
    expect(heatCellTextColor(heatCellVisual(bucket(0, 0)))).toBe(colors.textMuted);
    expect(heatCellTextColor(heatCellVisual(undefined))).toBe(colors.textMuted);
    expect(heatCellTextColor(heatCellVisual(undefined))).not.toBe(colors.textDim);
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
