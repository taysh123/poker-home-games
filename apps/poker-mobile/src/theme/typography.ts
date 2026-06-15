export const typography = {
  // Display — hero numbers, big headlines
  hero:    { fontSize: 42, fontWeight: '800' as const, letterSpacing: -1, lineHeight: 46 },
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.6, lineHeight: 38 },

  // Headings — Inter has a tall x-height, so tightened tracking + measured
  // line-heights keep titles crisp and premium rather than loose.
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4, lineHeight: 32 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 24 },
  h4: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.1, lineHeight: 22 },

  // Body
  bodyLarge: { fontSize: 17, fontWeight: '400' as const, lineHeight: 24 },
  body:      { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },

  // Labels / UI text
  label:      { fontSize: 15, fontWeight: '600' as const },
  labelSmall: { fontSize: 13, fontWeight: '600' as const },

  // Caps — section headers, badges, table headers
  caps: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },

  // Numeric amounts — explicit lineHeight so Inter's tall ascent isn't clipped
  // by a tight line box on web (the ₪ glyph + ExtraBold caps need the headroom).
  amount:      { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  amountLarge: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 36 },

  // Misc — kept for backward compat
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  caption:  { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.3 },
  mono:     { fontSize: 14, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const },

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
