import { colors } from '../colors';
import { RANK_COLORS, RARITY_COLORS, rarityColor } from '../rankRarity';

/**
 * One source for podium and rarity accents.
 *
 * Before this, rarity was defined THREE times (StatsScreen, AchievementUnlock,
 * AchievementsScreen) and rank twice (SessionScreen, GroupDetailScreen), with the copies already
 * drifted: two still inlined `#4EAADC` although `colors.info` is byte-identical and predates them,
 * all three inlined `#C46EE8` although `colors.aiPurple` was explicitly "promoted to a token" for
 * exactly this, and one carried a comment saying no token existed. Duplicated colour does not stay
 * equal — it just stops being checked.
 */
describe('rarity accents', () => {
  it('maps every rarity onto a design token, never a literal', () => {
    expect(RARITY_COLORS).toEqual({
      Common: colors.textMuted,
      Rare: colors.info,
      Epic: colors.aiPurple,
      Legendary: colors.gold,
    });
  });

  it('preserves the exact shipped values — this is a visual no-op', () => {
    // The migration must not change a single pixel. `info` and `aiPurple` are byte-identical to
    // the literals they replace; if either token is ever re-tuned, that is a deliberate visual
    // change and this assertion is where it must be acknowledged.
    expect(RARITY_COLORS.Rare).toBe('#4EAADC');
    expect(RARITY_COLORS.Epic).toBe('#C46EE8');
  });

  it('falls back to the muted token for an unknown rarity', () => {
    // Rarity arrives as a plain string from the server; an unrecognised value must not render
    // undefined (which React Native treats as "inherit" and can produce invisible text).
    expect(rarityColor('Mythic')).toBe(colors.textMuted);
    expect(rarityColor(undefined)).toBe(colors.textMuted);
  });

  it('resolves the known rarities', () => {
    expect(rarityColor('Legendary')).toBe(colors.gold);
    expect(rarityColor('Epic')).toBe(colors.aiPurple);
  });
});

describe('podium accents', () => {
  it('maps 1/2/3 onto tokens', () => {
    expect(RANK_COLORS).toEqual({
      1: colors.gold,
      2: colors.rankSilver,
      3: colors.rankBronze,
    });
  });

  it('preserves the exact shipped values — visual no-op', () => {
    expect(RANK_COLORS[1]).toBe('#C9A84C');
    expect(RANK_COLORS[2]).toBe('#8DA9C4');
    expect(RANK_COLORS[3]).toBe('#B87333');
  });

  it('keeps silver distinct from textMuted', () => {
    // They are visually adjacent (#8DA9C4 vs #8E9BAA) and were nearly collapsed. Silver is a
    // podium accent; textMuted is body copy. Collapsing them would tint 2nd place as disabled text.
    expect(colors.rankSilver).not.toBe(colors.textMuted);
  });


});
