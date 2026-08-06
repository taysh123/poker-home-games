/**
 * Heat-cell visual encoding (B5) — pure. This is where the B4 taste decision is enforced:
 * in the month view SIGN is carried by SHAPE (filled vs ringed) and only reinforced by hue,
 * so a losing day stays tellable from a winning one in grayscale and under any colour-vision
 * deficiency. Gold vs red is a weak pair under deuteranopia — both collapse toward
 * yellow-brown — and unlike BankrollHistogram a calendar cannot lean on position to carry the
 * sign, because the date owns the position.
 *
 * CONTRAST IS PART OF THE ENCODING, not a finish. A shape channel nobody can see is not a
 * shape channel: the first version of this file ramped wins through goldFaint/goldSubtle/
 * goldMuted (1.13:1, 1.29:1, 2.27:1 against the backdrop) and ringed losses in errorMuted
 * (1.54:1), so five of the eight played states carried no perceivable mark and collapsed back
 * into exactly the colour-alone failure B4 exists to prevent. Every value below is measured
 * against WCAG 1.4.11 (3:1, non-text) and 1.4.3 (4.5:1, the 13px day number), and the numbers
 * are pinned in the tests — a future token swap that dims one of these goes red.
 *
 * Decision of record: docs/superpowers/specs/2026-08-05-b4-calendar-heatmap-taste-direction.md
 */
import { colors } from '../../../theme/colors';
import { formatCents } from '../../../utils/money';
import { monthLabel } from './monthGrid';
import type { DayHeatLevel } from './calendar';

export type HeatCellKind = 'none' | 'even' | 'win' | 'loss';

export interface HeatCellVisual {
  kind: HeatCellKind;
  /** Ramp position 1..RAMP_STEPS for win/loss; 0 for 'none' and 'even'. */
  step: number;
}

export interface HeatCellStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
}

/**
 * Wins FILL. Each step clears 3:1 against the backdrop; step 1 carries light text, steps 2-4
 * dark text (see the alpha rationale beside the tokens in theme/colors.ts).
 */
const WIN_FILL = [colors.goldHeat1, colors.goldHeat2, colors.goldHeat3, colors.gold];
/**
 * Losses RING, and the ring is solid `error` at EVERY step (4.64:1) — magnitude rides the
 * width alone. The previous version dimmed steps 1-2 to `errorMuted` (1.54:1), which made the
 * smallest losses invisible; a loss you cannot see is worse than a loss you cannot size.
 */
const LOSS_WIDTH = [2, 3, 4, 5];
/** The ramp length. `step` is clamped to this, NOT to a caller-supplied levelCount. */
export const RAMP_STEPS = WIN_FILL.length;

export function heatCellVisual(bucket: DayHeatLevel | undefined): HeatCellVisual {
  if (!bucket) return { kind: 'none', step: 0 };
  if (bucket.level === 0) return { kind: 'even', step: 0 };
  // `heatmapLevels` bands to 1..RAMP_STEPS by construction, so this clamp is belt-and-braces
  // against a hand-built bucket rather than a live path — but indexing off the end of the ramp
  // arrays returns `undefined` styles, which renders a loss identically to a no-session day.
  // That collapse is the one failure this module exists to prevent, so it stays guarded.
  const step = Math.min(Math.abs(bucket.level), RAMP_STEPS);
  return { kind: bucket.level > 0 ? 'win' : 'loss', step };
}

export function heatCellStyle(v: HeatCellVisual): HeatCellStyle {
  switch (v.kind) {
    case 'win':
      return { backgroundColor: WIN_FILL[v.step - 1], borderColor: 'transparent', borderWidth: 0 };
    case 'loss':
      return {
        backgroundColor: 'transparent',
        borderColor: colors.error,
        borderWidth: LOSS_WIDTH[v.step - 1],
      };
    case 'even':
      // textMuted (6.27:1), not `border` (#243447, 1.40:1) — a hairline nobody can see left the
      // third required state carried by the day-number colour alone.
      return { backgroundColor: 'transparent', borderColor: colors.textMuted, borderWidth: 1 };
    default:
      return { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 };
  }
}

export function heatCellTextColor(v: HeatCellVisual): string {
  // Unplayed days previously used textDim (1.95:1) — below the 4.5:1 floor on the MAJORITY of
  // cells in a normal month. De-emphasis comes from having no fill or ring at all, not from
  // making the date unreadable.
  if (v.kind === 'none') return colors.textMuted;
  if (v.kind === 'even') return colors.textMuted;
  // Wins invert from step 2 up: those fills are too light to carry light text at 4.5:1.
  if (v.kind === 'win' && v.step >= 2) return colors.background;
  return colors.textHigh;
}

/** Composed accessible name. Pinned in tests so the spoken name cannot drift from the cell. */
export function dayCellLabel(
  dayKey: string,
  dayNumber: number,
  bucket: DayHeatLevel | undefined,
): string {
  const [y, m] = dayKey.split('-');
  const day = `${monthLabel(`${y}-${m}`).split(' ')[0]} ${dayNumber}`;
  if (!bucket) return `${day}, no session`;
  const sessions = `${bucket.sessionCount} session${bucket.sessionCount === 1 ? '' : 's'}`;
  if (bucket.netCents === 0) return `${day}, broke even, ${sessions}`;
  const dir = bucket.netCents > 0 ? 'up' : 'down';
  return `${day}, ${dir} ${formatCents(Math.abs(bucket.netCents))}, ${sessions}`;
}
