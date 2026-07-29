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

/**
 * `undefined`/`null`/empty all collapse to the shared signed-out bucket.
 *
 * DELIBERATE BEHAVIOUR CHANGE, stated rather than slipped in: the previous inline literal used
 * `?? 'anon'`, so an EMPTY-STRING user id produced `tpoker.seenAch.` — a bare prefix with a
 * trailing dot, shared by every such user. `||` collapses it to the `anon` bucket instead.
 *
 * Migration impact is nil in practice: `userId` is a server-issued GUID and is never `''`, so no
 * existing key changes. For every reachable input — a real id, `undefined`, `null` — output is
 * byte-identical to the old expression, which is what matters: a changed key makes a stored
 * baseline unreadable and replays a user's entire badge history at them.
 */
export function seenAchievementsKey(userId: string | null | undefined): string {
  return `${SEEN_ACHIEVEMENTS_PREFIX}${userId || 'anon'}`;
}
