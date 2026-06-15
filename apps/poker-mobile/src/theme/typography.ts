import { Sora, Inter } from './fonts';

/**
 * Type roles (premium 3-face system):
 *   • DM Serif Display — display titles + hero money numerals (`displaySerif`, `amountHero`)
 *   • Sora            — headings, labels, caps, buttons, UI chrome (geometric character)
 *   • Inter           — body/secondary text + tabular numerals
 *
 * Families are set explicitly so the global Text patch (theme/fonts.ts) renders the
 * right face at its true weight (it normalises fontWeight to avoid web faux-bold).
 * Untokenised text falls back to Inter-by-weight via the same patch.
 */
export const typography = {
  // Display headlines — Sora ExtraBold (serif display lives in `displaySerif`)
  hero:    { fontFamily: Sora['800'], fontSize: 42, fontWeight: '800' as const, letterSpacing: -1, lineHeight: 46 },
  display: { fontFamily: Sora['800'], fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.6, lineHeight: 38 },

  // Headings — Sora
  h1: { fontFamily: Sora['700'], fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4, lineHeight: 32 },
  h2: { fontFamily: Sora['700'], fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 28 },
  h3: { fontFamily: Sora['700'], fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 24 },
  h4: { fontFamily: Sora['600'], fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.1, lineHeight: 22 },

  // Body — Inter
  bodyLarge: { fontFamily: Inter['400'], fontSize: 17, fontWeight: '400' as const, lineHeight: 24 },
  body:      { fontFamily: Inter['400'], fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontFamily: Inter['400'], fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },

  // Labels / UI text — Sora
  label:      { fontFamily: Sora['600'], fontSize: 15, fontWeight: '600' as const },
  labelSmall: { fontFamily: Sora['600'], fontSize: 13, fontWeight: '600' as const },

  // Caps — section headers, badges, table headers — Sora
  caps: {
    fontFamily: Sora['600'],
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },

  // Numeric amounts — Inter tabular; explicit lineHeight so the ₪ glyph + bold caps
  // aren't clipped by a tight line box on web.
  amount:      { fontFamily: Inter['700'], fontSize: 20, fontWeight: '700' as const, lineHeight: 26, fontVariant: ['tabular-nums'] as Array<'tabular-nums'> },
  amountLarge: { fontFamily: Inter['800'], fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 36, fontVariant: ['tabular-nums'] as Array<'tabular-nums'> },

  // Misc — kept for backward compat
  bodyBold: { fontFamily: Inter['600'], fontSize: 15, fontWeight: '600' as const },
  caption:  { fontFamily: Inter['500'], fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.3 },
  mono:     { fontFamily: Inter['700'], fontSize: 14, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const },

  // ── Velvet Table display accents (DM Serif Display, loaded in App.tsx) ──
  // Screen titles only. Falls back to system font if the font fails to load.
  displaySerif: { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 30, letterSpacing: 0.2 },
  // Hero money numerals only (Home P&L, total pot, summary). Always tabular.
  amountHero: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 44,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'] as Array<'tabular-nums'>,
  },
} as const;
