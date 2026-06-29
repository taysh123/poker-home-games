import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import PressableScale from './motion/PressableScale';
import AnimatedNumber from './motion/AnimatedNumber';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { useEngagement } from '../features/engagement/state/EngagementContext';

/**
 * Cosmetic XP / rank surface (V2.1 STEP 3.4). Renders nothing when `retention` is off.
 * Optionally tappable (e.g. → Achievements).
 */
export default function RankBadge({ onPress }: { onPress?: () => void }) {
  const { enabled, xpTotal, rank } = useEngagement();
  if (!enabled) return null;

  const toNext = rank.next ? Math.max(0, rank.next.min - xpTotal) : 0;
  const a11y = `Rank ${rank.rank.name}, ${xpTotal} XP` + (rank.next ? `, ${toNext} to ${rank.next.name}` : '');

  const inner = (
    <Card style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="ribbon" size={22} color={colors.gold} />
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.rankName}>{rank.rank.name}</Text>
          <AnimatedNumber value={xpTotal} format={(n) => `${n} XP`} style={styles.xp} />
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(rank.progressPct * 100)}%` }]} />
        </View>
        <Text style={styles.next}>
          {rank.next ? `${toNext} XP to ${rank.next.name}` : 'Max rank — Legend'}
        </Text>
      </View>
    </Card>
  );

  if (!onPress) {
    return <View accessible accessibilityLabel={a11y}>{inner}</View>;
  }
  return (
    <PressableScale onPress={onPress} haptic="light" accessibilityRole="button" accessibilityLabel={a11y}>
      {inner}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.goldFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankName: { ...typography.h4, color: colors.text },
  xp: { ...typography.labelSmall, color: colors.gold },
  track: { height: 6, borderRadius: radii.pill, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.gold },
  next: { ...typography.bodySmall, color: colors.textMuted, fontSize: 11 },
});
