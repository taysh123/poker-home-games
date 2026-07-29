import { colors } from './colors';

/**
 * Podium and rarity accents — ONE source.
 *
 * Rarity was previously defined three times (StatsScreen, AchievementUnlock, AchievementsScreen)
 * and rank twice (SessionScreen, GroupDetailScreen). The copies had already drifted: two still
 * inlined `#4EAADC` although `colors.info` is byte-identical and predates them; all three inlined
 * `#C46EE8` although `colors.aiPurple` was added with the comment "same hue as the Epic
 * achievement rarity — promoted to a token" and no map was ever migrated onto it; and one carried
 * a comment asserting no token existed. Duplicated colour does not stay equal, it just stops being
 * checked.
 *
 * Every value here is byte-identical to what shipped — this consolidation is a visual no-op, and
 * `__tests__/rankRarity.test.ts` pins the literals so it stays one.
 */

/** Achievement rarity → accent. Keyed by the plain strings the server and local catalog emit. */
export const RARITY_COLORS: Record<string, string> = {
  Common: colors.textMuted,
  Rare: colors.info,
  Epic: colors.aiPurple,
  Legendary: colors.gold,
};

/**
 * Rarity arrives as an unvalidated string. An unknown value must not resolve to `undefined` —
 * React Native treats that as "inherit", which can render an accent invisibly.
 */
export function rarityColor(rarity: string | undefined | null): string {
  // `hasOwn`, not plain indexing: RARITY_COLORS is an object literal, so it inherits
  // Object.prototype and `rarityColor('toString')` would return a FUNCTION rather than a colour.
  // Unreachable from either data source, but the guarantee above should be true, not lucky.
  if (rarity && Object.prototype.hasOwnProperty.call(RARITY_COLORS, rarity)) {
    return RARITY_COLORS[rarity];
  }
  return colors.textMuted;
}

/**
 * Podium default for places outside the top three. Lives here so the one consumer
 * (GroupDetailScreen's leaderboard) does not carry an unpinned literal: a mutation run changed
 * that call site's fallback to `colors.error` — a red 4th place — and all 1,094 tests stayed green.
 */
export const RANK_DEFAULT = colors.textDim;

/**
 * Podium places 1-3. Consumers supply their own out-of-podium default — GroupDetailScreen wants
 * `colors.textDim`, not a null. An exported `rankColor()` helper was written here and deleted
 * before merge: nothing consumed it, and its documented behaviour (`null` for 4th) disagreed with
 * the one real caller. Shipping a helper that contradicts its only consumer is how the drift this
 * module exists to end gets reintroduced.
 */
export const RANK_COLORS: Record<number, string> = {
  1: colors.gold,
  2: colors.rankSilver,
  3: colors.rankBronze,
};
