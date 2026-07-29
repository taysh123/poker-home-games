import { SEEN_ACHIEVEMENTS_PREFIX, seenAchievementsKey } from '../seenAchievements';

/**
 * The key that stores "which server achievements has this device already celebrated".
 *
 * It was an inline template literal built from a value captured by an empty-dependency
 * `useCallback`. Two problems, both pinned here: the FORMAT was unpinned (changing it silently
 * resets every user's celebration baseline and replays their whole badge history at them), and
 * the identity was a stale capture.
 */
describe('seenAchievementsKey', () => {
  it('namespaces per user id', () => {
    expect(seenAchievementsKey('u-123')).toBe('tpoker.seenAch.u-123');
  });

  it('falls back to anon when there is no user', () => {
    expect(seenAchievementsKey(undefined)).toBe('tpoker.seenAch.anon');
    expect(seenAchievementsKey(null)).toBe('tpoker.seenAch.anon');
    expect(seenAchievementsKey('')).toBe('tpoker.seenAch.anon');
  });

  it('pins the literal prefix — changing it resets every baseline', () => {
    // Not `SEEN_ACHIEVEMENTS_PREFIX + id`, which would self-adjust to any prefix change. The
    // literal is the point: a silent rename replays a user's entire badge history as "new".
    expect(SEEN_ACHIEVEMENTS_PREFIX).toBe('tpoker.seenAch.');
  });

  it('never collides two different users onto one key', () => {
    expect(seenAchievementsKey('a')).not.toBe(seenAchievementsKey('b'));
    expect(seenAchievementsKey('a')).not.toBe(seenAchievementsKey(undefined));
  });
});
