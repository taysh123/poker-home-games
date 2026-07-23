import type { Config } from 'tailwindcss';

/**
 * Design tokens for the T Poker marketing site.
 * Single source of truth for the site palette — complements the mobile app
 * (apps/poker-mobile/src/theme/colors.ts) but lives independently here.
 * Premium + restrained: gold is an accent, never a casino flood.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0F1923',
        surface: '#1A2535',
        surfaceHigh: '#1E2D3D',
        border: '#243447',
        gold: '#C9A84C',
        goldLight: '#E8C97A',
        goldDark: '#A8872E',
        text: '#FFFFFF',
        textHigh: '#E8EDF2',
        textMuted: '#7A8A99',
        success: '#27AE60',
        error: '#E74C3C',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'ui-serif', 'serif'],
      },
      fontSize: {
        // Modular scale (rem): 0.875 / 1 / 1.125 / 1.25 / 1.75 / 2.5 / 4
        hero: ['clamp(2.5rem, 6vw, 4rem)', { lineHeight: '1.04', letterSpacing: '-0.02em' }],
        // Fluid like `hero`. Fixed at 40px, a long h2 ran to four lines on a 375px screen.
        display: ['clamp(1.875rem, 5vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        title: ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      maxWidth: {
        container: '1120px',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
