export const colors = {
  background: '#0F1923',
  surface: '#1A2535',
  surfaceHigh: '#1E2D3D',
  surfaceAlt: '#1C2A3A',
  surfaceOverlay: 'rgba(15,25,35,0.85)',
  border: '#243447',
  gold: '#C9A84C',
  goldLight: '#E8C97A',
  goldDark: '#A8872E',
  goldFaint: 'rgba(201,168,76,0.08)',
  goldSubtle: 'rgba(201,168,76,0.15)',
  goldMuted: 'rgba(201,168,76,0.40)',
  text: '#FFFFFF',
  textHigh: '#E8EDF2',
  textMuted: '#8E9BAA',
  textDim: '#3A4A5A',
  error: '#E74C3C',
  errorFaint: 'rgba(231,76,60,0.08)',
  errorMuted: 'rgba(231,76,60,0.35)',
  success: '#27AE60',
  warning: '#F39C12',
  bgOverlay: 'rgba(15,25,35,0.6)',
  // ── Semantic tone faints (additive — power the Chip primitive's subtle variants) ──
  successFaint: 'rgba(39,174,96,0.12)',
  warningFaint: 'rgba(243,156,18,0.12)',
  info: '#4EAADC',
  infoFaint: 'rgba(78,170,220,0.12)',
  // ── Velvet Table additions (additive — never rename the tokens above) ──
  backgroundDeep: '#0A111B',
  // ── Immersive poker-table (STEP 5.3) — deep green felt that stays on-brand with navy/gold ──
  felt: '#15413A',
  feltDeep: '#0C2A26',
  feltRim: '#0A211D',
  // ── Landing v3 section accents (approved 2026-07-06) — AMBIENT ONLY: eyebrow text +
  //    media glows. Gold remains the sole CTA color; headings stay white serif. ──
  feltGlow: 'rgba(26,75,67,0.45)',
  feltFaint: 'rgba(26,75,67,0.18)',
  tealGlow: 'rgba(78,170,220,0.10)',
  aiPurple: '#C46EE8', // same hue as the Epic achievement rarity — promoted to a token
  aiPurpleFaint: 'rgba(196,110,232,0.10)',
};

/** Felt table gradient (center → edge) for the immersive PokerTable surface. */
export const tableGradients = {
  felt: ['#1A4B43', '#15413A', '#0C2A26'] as const,
};

/** Static gradient stops for expo-linear-gradient (Velvet Table system). */
export const gradients = {
  /** Primary CTA fill — light-to-deep gold, diagonal. */
  goldShine: ['#E8C97A', '#C9A84C', '#9C7E33'] as const,
  /** Subtle top-lit sheen for elevated surfaces. */
  surfaceSheen: ['#1E2D3D', '#1A2535'] as const,
  /** Ambient screen background — lighter navy fading into the deep base. */
  screenVignette: ['#101C2A', '#0A111B'] as const,
};
