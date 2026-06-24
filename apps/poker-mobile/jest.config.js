/** Pure-logic tests only for now (settlement engine, local store). */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '**/src/local/__tests__/**/*.test.ts',
    '**/src/utils/__tests__/**/*.test.ts',
    '**/src/features/**/__tests__/**/*.test.ts',
    '**/src/api/__tests__/**/*.test.ts',
    '**/src/content/__tests__/**/*.test.ts',
    '**/src/analytics/__tests__/**/*.test.ts',
    '**/src/components/__tests__/**/*.test.ts',
    '**/src/hooks/__tests__/**/*.test.ts',
    '**/src/config/__tests__/**/*.test.ts',
  ],
};
