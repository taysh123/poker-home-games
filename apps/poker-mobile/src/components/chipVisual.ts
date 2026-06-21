/**
 * Chip visual resolver — PURE (no RN imports), so it's unit-testable like the rest of the codebase's logic.
 * The Chip component (Chip.tsx) renders from this; tests assert this. Imports only plain token objects.
 */
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export type ChipTone = 'neutral' | 'gold' | 'success' | 'error' | 'warning' | 'info';
export type ChipSize = 'sm' | 'md';

interface ToneSpec { fg: string; bg: string; border: string; solidBg: string; }

const TONES: Record<ChipTone, ToneSpec> = {
  neutral: { fg: colors.textMuted, bg: colors.surfaceHigh, border: colors.border, solidBg: colors.surfaceHigh },
  gold: { fg: colors.gold, bg: colors.goldFaint, border: colors.goldMuted, solidBg: colors.gold },
  success: { fg: colors.success, bg: colors.successFaint, border: colors.success, solidBg: colors.success },
  error: { fg: colors.error, bg: colors.errorFaint, border: colors.errorMuted, solidBg: colors.error },
  warning: { fg: colors.warning, bg: colors.warningFaint, border: colors.warning, solidBg: colors.warning },
  info: { fg: colors.info, bg: colors.infoFaint, border: colors.info, solidBg: colors.info },
};

const SZ: Record<ChipSize, { font: number; padH: number; padV: number }> = {
  sm: { font: 10, padH: spacing.sm, padV: 2 },
  md: { font: 11, padH: 10, padV: 3 },
};

export interface ChipVisual { fg: string; bg: string; border: string; font: number; padH: number; padV: number; }

/** tone + solid + size → resolved colors + geometry. `solid` flips fg to the on-accent color. */
export function chipVisual(tone: ChipTone, solid: boolean, size: ChipSize): ChipVisual {
  const t = TONES[tone];
  const sz = SZ[size];
  return {
    fg: solid ? colors.background : t.fg,
    bg: solid ? t.solidBg : t.bg,
    border: solid ? t.solidBg : t.border,
    font: sz.font,
    padH: sz.padH,
    padV: sz.padV,
  };
}
