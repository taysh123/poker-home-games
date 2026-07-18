/** Pure-logic tests + the web-only landing render smoke test. */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '**/src/local/__tests__/**/*.test.ts',
    '**/src/utils/__tests__/**/*.test.ts',
    '**/src/features/**/__tests__/**/*.test.ts',
    '**/src/api/__tests__/**/*.test.ts',
    '**/src/content/__tests__/**/*.test.ts',
    '**/src/analytics/__tests__/**/*.test.ts',
    '**/src/components/__tests__/**/*.test.ts?(x)',
    '**/src/components/motion/__tests__/**/*.test.ts',
    '**/src/components/brand/__tests__/**/*.test.ts?(x)',
    '**/src/navigation/__tests__/**/*.test.ts',
    '**/src/hooks/__tests__/**/*.test.ts',
    '**/src/config/__tests__/**/*.test.ts',
    '**/src/screens/__tests__/**/*.test.tsx',
  ],
};
