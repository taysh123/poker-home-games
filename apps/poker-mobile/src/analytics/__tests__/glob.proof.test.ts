/**
 * PR #1 proof test — confirms jest's testMatch now picks up `src/analytics/__tests__/**`
 * (previously excluded). No analytics logic yet; this only proves the glob runs.
 */
describe('analytics glob (PR #1)', () => {
  it('runs from src/analytics (glob coverage)', () => {
    expect(true).toBe(true);
  });
});
