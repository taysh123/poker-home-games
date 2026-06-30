import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import { RootStackParamList } from '../navigation/AppNavigator';
import StatWidget from '../components/StatWidget';
import EmptyState from '../components/EmptyState';
import SectionTitle from '../components/SectionTitle';
import Screen from '../components/Screen';
import PressableScale from '../components/motion/PressableScale';
import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLocalGames } from '../context/LocalGamesContext';
import { computeLocalStats } from '../local/localStats';
import { formatCents } from '../utils/money';
import { timeAgo } from '../utils/formatters';
import { markSignupIntent } from '../utils/analytics';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Stats tab for guests: table-level stats from local games + account upsell. */
export default function GuestStatsScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { games } = useLocalGames();

  const stats = computeLocalStats(games);

  if (stats.gamesPlayed === 0) {
    return (
      <Screen style={{ paddingTop: embedded ? 0 : insets.top }}>
        {!embedded && <Text style={[styles.title, styles.titleStandalone]}>Stats</Text>}
        <EmptyState
          ionicon="bar-chart-outline"
          title="No numbers yet"
          subtitle={
            'Finish a game and your table stats show up here.\n\nWant lifetime P&L, win rate, and head-to-head records? That comes with a free account.'
          }
          action={{ label: 'Sign In', onPress: () => { markSignupIntent(); navigation.navigate('Login'); } }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: embedded ? spacing.sm : insets.top + spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        {!embedded && <Text style={styles.title}>Stats</Text>}
        <Text style={styles.subtitle}>From games on this device</Text>
      </View>

      <View style={styles.grid}>
        <StatWidget label="Games Played" value={String(stats.gamesPlayed)} ionicon="layers-outline" delay={0} />
        <StatWidget
          label="Money on the Table"
          value={formatCents(stats.totalMoneyMovedCents)}
          ionicon="cash-outline"
          delay={60}
        />
        <StatWidget
          label="Biggest Win"
          value={stats.biggestWinCents > 0 ? `+${formatCents(stats.biggestWinCents)}` : '—'}
          sub={stats.biggestWinPlayerName ?? undefined}
          valueColor={stats.biggestWinCents > 0 ? colors.success : colors.textMuted}
          ionicon="trophy-outline"
          delay={120}
        />
      </View>

      {stats.recentResults.length > 0 && (
        <View style={styles.section}>
          <SectionTitle>RECENT RESULTS</SectionTitle>
          <View style={styles.sectionCard}>
            {stats.recentResults.map((result, i) => (
              <MotiView key={result.gameId} {...slideUpSequence({ reduced, delay: staggerIn(i) })}>
                <PressableScale
                  style={[styles.resultRow, i > 0 && styles.rowBorder]}
                  onPress={() => navigation.navigate('LocalSessionSummary', { gameId: result.gameId })}
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityLabel={`${result.name}, ${result.playerCount} players, ${formatCents(result.totalPotCents)} pot${result.winnerName ? `, won by ${result.winnerName}` : ''}`}
                >
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName} numberOfLines={1}>{result.name}</Text>
                    <Text style={styles.resultMeta}>
                      {result.playerCount} players · {formatCents(result.totalPotCents)} pot · {timeAgo(result.endedAt)}
                    </Text>
                  </View>
                  {result.winnerName ? (
                    <View style={styles.winnerWrap}>
                      <Ionicons name="trophy" size={iconSize.xs} color={colors.goldLight} />
                      <Text style={styles.resultWinner} numberOfLines={1}>{result.winnerName}</Text>
                    </View>
                  ) : null}
                </PressableScale>
              </MotiView>
            ))}
          </View>
        </View>
      )}

      {/* Account upsell — conversion surface; navigation preserved exactly */}
      <PressableScale
        style={styles.upsellCard}
        onPress={() => navigation.navigate('Login')}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel="Track your numbers. Sign in for personal lifetime P and L, win rate, streaks, achievements, and head-to-head records."
      >
        <View style={styles.upsellIconWrap}>
          <Ionicons name="trending-up" size={iconSize.sm} color={colors.gold} />
        </View>
        <View style={styles.upsellText}>
          <Text style={styles.upsellTitle}>Track YOUR numbers</Text>
          <Text style={styles.upsellSubtitle}>
            Sign in for personal lifetime P&L, win rate, streaks, achievements, and head-to-head records.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={iconSize.xs} color={colors.textMuted} />
      </PressableScale>

      <View style={{ height: spacing.huge * 2 }} />
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  header: { gap: spacing.xs },
  title: { ...typography.displaySerif, color: colors.text },
  titleStandalone: { padding: spacing.xl, paddingBottom: 0 },
  subtitle: { ...typography.bodySmall, color: colors.textMuted },

  grid: { gap: spacing.md },

  section: { gap: spacing.sm },
  sectionCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  resultInfo: { flex: 1, gap: 2 },
  resultName: { ...typography.label, color: colors.text },
  resultMeta: { ...typography.caption, color: colors.textMuted },
  winnerWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: 130 },
  resultWinner: { ...typography.caption, fontWeight: '700', color: colors.goldLight, flexShrink: 1 },

  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  upsellIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.control,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellText: { flex: 1, gap: 3 },
  upsellTitle: { ...typography.label, color: colors.text },
  upsellSubtitle: { ...typography.caption, color: colors.textMuted, lineHeight: 17 },
});
