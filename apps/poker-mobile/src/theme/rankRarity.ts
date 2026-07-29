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
  return (rarity && RARITY_COLORS[rarity]) || colors.textMuted;
}

/** Podium places 1-3. */
export const RANK_COLORS: Record<number, string> = {
  1: colors.gold,
  2: colors.rankSilver,
  3: colors.rankBronze,
};

/** `null` outside the podium, so callers render the default colour rather than a medal tint. */
export function rankColor(rank: number): string | null {
  return RANK_COLORS[rank] ?? null;
}
