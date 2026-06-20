/**
 * PR #1 proof test — confirms jest's testMatch now picks up `src/content/__tests__/**`
 * (previously excluded, so content tests would have silently never run). Also locks in that the
 * new `content` + `mastery` feature flags exist and resolve to a boolean. No content logic yet.
 */
import { featureFlags } from '../../config/features';

describe('content glob + flags (PR #1)', () => {
  it('runs from src/content (glob coverage)', () => {
    expect(true).toBe(true);
  });

  it('exposes the content + mastery flags as booleans', () => {
    expect(typeof featureFlags.content).toBe('boolean');
    expect(typeof featureFlags.mastery).toBe('boolean');
  });
});
