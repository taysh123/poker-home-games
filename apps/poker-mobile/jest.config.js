/**
 * Pure-logic tests + the web-only landing render smoke test.
 *
 * EVERY glob ends `*.test.ts?(x)`. Mixed extensions were a live trap: a `.tsx` test dropped into
 * `src/hooks/__tests__/` (or motion/navigation/config) was **silently skipped, not failed**, and
 * `src/screens/` matched only `.tsx` so a `.ts` test there vanished the same way. A test that
 * never runs is worse than no test — it reports as coverage. Found by a critic that hit it live
 * while writing a hook test.
 *
 * Keep `?(x)` on anything added here.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '**/src/local/__tests__/**/*.test.ts?(x)',
    '**/src/utils/__tests__/**/*.test.ts?(x)',
    '**/src/features/**/__tests__/**/*.test.ts?(x)',
    '**/src/api/__tests__/**/*.test.ts?(x)',
    '**/src/content/__tests__/**/*.test.ts?(x)',
    '**/src/analytics/__tests__/**/*.test.ts?(x)',
    '**/src/components/__tests__/**/*.test.ts?(x)',
    '**/src/components/motion/__tests__/**/*.test.ts?(x)',
    '**/src/components/brand/__tests__/**/*.test.ts?(x)',
    '**/src/navigation/__tests__/**/*.test.ts?(x)',
    '**/src/hooks/__tests__/**/*.test.ts?(x)',
    '**/src/config/__tests__/**/*.test.ts?(x)',
    '**/src/screens/__tests__/**/*.test.ts?(x)',
    '**/src/theme/__tests__/**/*.test.ts?(x)',
  ],
};
