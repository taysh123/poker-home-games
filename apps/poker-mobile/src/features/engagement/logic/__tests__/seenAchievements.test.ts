import { SEEN_ACHIEVEMENTS_PREFIX, seenAchievementsKey } from '../seenAchievements';

/**
 * The key that stores "which server achievements has this device already celebrated".
 *
 * It was an inline template literal built from a value captured by an empty-dependency
 * `useCallback`. Two problems, both pinned here: the FORMAT was unpinned (changing it silently
 * resets every user's celebration baseline and replays their whole badge history at them), and
 * the identity was a stale capture.
 */
/** The expression this helper replaced, verbatim, for equivalence checking. */
const oldInlineKey = (id: string | null | undefined) => `tpoker.seenAch.${id ?? 'anon'}`;

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

  it('is byte-identical to the OLD inline expression for every reachable input', () => {
    // Migration guarantee. The helper replaced `tpoker.seenAch.${user?.userId ?? 'anon'}` at two
    // call sites. If the output differs for any input a real user can produce, their stored
    // baseline becomes unreadable and their entire earned-badge history replays as "new".
    for (const id of ['a1b2c3', '00000000-0000-0000-0000-000000000001', undefined, null]) {
      expect(seenAchievementsKey(id)).toBe(oldInlineKey(id));
    }
  });

  it('deliberately DIFFERS from the old expression only for empty string', () => {
    // The one intentional divergence, pinned so it stays intentional. `?? 'anon'` let '' through
    // and produced a bare `tpoker.seenAch.` shared by every such user. userId is a server GUID,
    // so this input is unreachable — but if it ever became reachable, `anon` is the right bucket.
    expect(oldInlineKey('')).toBe('tpoker.seenAch.');
    expect(seenAchievementsKey('')).toBe('tpoker.seenAch.anon');
  });

  it('never collides two different users onto one key', () => {
    expect(seenAchievementsKey('a')).not.toBe(seenAchievementsKey('b'));
    expect(seenAchievementsKey('a')).not.toBe(seenAchievementsKey(undefined));
  });
});
