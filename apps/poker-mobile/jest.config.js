/** Pure-logic tests only for now (settlement engine, local store). */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '**/src/local/__tests__/**/*.test.ts',
    '**/src/utils/__tests__/**/*.test.ts',
  ],
};
