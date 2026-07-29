/**
 * Storage key for "server achievements this device has already celebrated".
 *
 * Extracted from an inline template literal in StatsScreen so the format is pinned and the user
 * id is an explicit argument rather than a value captured by an empty-dependency `useCallback`.
 *
 * The format is load-bearing: renaming it makes every stored baseline unreadable, so the next
 * load treats a user's entire earned-badge history as freshly unlocked and replays the whole
 * celebration queue at them. Pinned to the literal in __tests__/seenAchievements.test.ts.
 */
export const SEEN_ACHIEVEMENTS_PREFIX = 'tpoker.seenAch.';

/** `undefined`/`null`/empty all collapse to the shared signed-out bucket. */
export function seenAchievementsKey(userId: string | null | undefined): string {
  return `${SEEN_ACHIEVEMENTS_PREFIX}${userId || 'anon'}`;
}
