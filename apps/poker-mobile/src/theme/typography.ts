export const typography = {
  // Display — hero numbers, big headlines
  hero:    { fontSize: 42, fontWeight: '800' as const, letterSpacing: -1 },
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },

  // Headings
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 18, fontWeight: '700' as const },
  h4: { fontSize: 16, fontWeight: '600' as const },

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

  // Numeric amounts
  amount:      { fontSize: 20, fontWeight: '700' as const },
  amountLarge: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },

  // Misc — kept for backward compat
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  caption:  { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.3 },
  mono:     { fontSize: 14, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const },
} as const;
