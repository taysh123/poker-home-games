export const typography = {
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.3 },
  label: { fontSize: 13, fontWeight: '500' as const },
  mono: { fontSize: 14, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const },
} as const;
