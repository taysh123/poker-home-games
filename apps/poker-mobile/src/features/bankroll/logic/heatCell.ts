/**
 * Heat-cell visual encoding (B5) — pure. This is where the B4 taste decision is enforced:
 * in the month view SIGN is carried by SHAPE (filled vs hollow) and only reinforced by hue,
 * so a losing day stays tellable from a winning one in grayscale and under any colour-vision
 * deficiency. Gold vs red is a weak pair under deuteranopia — both collapse toward
 * yellow-brown — and unlike BankrollHistogram a calendar cannot lean on position to carry the
 * sign, because the date owns the position.
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
  /** Ramp position 1..levelCount for win/loss; 0 for 'none' and 'even'. */
  step: number;
}

export interface HeatCellStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
}

/** Gold opacity ramp — these four tokens ARE an alpha ramp: 0.08, 0.15, 0.40, 1.0. */
const WIN_FILL = [colors.goldFaint, colors.goldSubtle, colors.goldMuted, colors.gold];
/** Losers ramp on ring weight + colour, never on fill (see the module header). */
const LOSS_BORDER = [colors.errorMuted, colors.errorMuted, colors.error, colors.error];
const LOSS_WIDTH = [2, 2.5, 3, 3.5];

export function heatCellVisual(bucket: DayHeatLevel | undefined, levelCount = 4): HeatCellVisual {
  if (!bucket) return { kind: 'none', step: 0 };
  if (bucket.level === 0) return { kind: 'even', step: 0 };
  // Clamp: heatmapLevels already bounds this, but a style lookup must never index off the end.
  const step = Math.min(Math.abs(bucket.level), levelCount);
  return { kind: bucket.level > 0 ? 'win' : 'loss', step };
}

export function heatCellStyle(v: HeatCellVisual): HeatCellStyle {
  switch (v.kind) {
    case 'win':
      return { backgroundColor: WIN_FILL[v.step - 1], borderColor: 'transparent', borderWidth: 0 };
    case 'loss':
      return {
        backgroundColor: 'transparent',
        borderColor: LOSS_BORDER[v.step - 1],
        borderWidth: LOSS_WIDTH[v.step - 1],
      };
    case 'even':
      return { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 };
    default:
      return { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 };
  }
}

export function heatCellTextColor(v: HeatCellVisual): string {
  if (v.kind === 'none') return colors.textDim;
  if (v.kind === 'even') return colors.textMuted;
  // The top win step is the only OPAQUE fill; white on solid gold fails contrast.
  if (v.kind === 'win' && v.step === WIN_FILL.length) return colors.background;
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
