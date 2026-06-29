import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { RootStackParamList } from '../navigation/AppNavigator';
import StatWidget from '../components/StatWidget';
import EmptyState from '../components/EmptyState';
import Screen from '../components/Screen';
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
  const { games } = useLocalGames();

  const stats = computeLocalStats(games);

  if (stats.gamesPlayed === 0) {
    return (
      <Screen style={{ paddingTop: embedded ? 0 : insets.top }}>
        {!embedded && <Text style={[styles.title, { padding: 20, paddingBottom: 0 }]}>Stats</Text>}
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
    <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingTop: embedded ? 8 : insets.top + 20 }]}>
      {!embedded && <Text style={styles.title}>Stats</Text>}
      <Text style={styles.subtitle}>From games on this device</Text>

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
          <Text style={styles.sectionTitle}>RECENT RESULTS</Text>
          <View style={styles.sectionCard}>
            {stats.recentResults.map(result => (
              <TouchableOpacity
                key={result.gameId}
                style={styles.resultRow}
                onPress={() => navigation.navigate('LocalSessionSummary', { gameId: result.gameId })}
                activeOpacity={0.7}
              >
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName} numberOfLines={1}>{result.name}</Text>
                  <Text style={styles.resultMeta}>
                    {result.playerCount} players · {formatCents(result.totalPotCents)} pot · {timeAgo(result.endedAt)}
                  </Text>
                </View>
                {result.winnerName ? (
                  <Text style={styles.resultWinner} numberOfLines={1}>🏆 {result.winnerName}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Account upsell */}
      <TouchableOpacity style={styles.upsellCard} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
        <View style={styles.upsellIconWrap}>
          <Ionicons name="trending-up" size={20} color={colors.gold} />
        </View>
        <View style={styles.upsellText}>
          <Text style={styles.upsellTitle}>Track YOUR numbers</Text>
          <Text style={styles.upsellSubtitle}>
            Sign in for personal lifetime P&L, win rate, streaks, achievements, and head-to-head records.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 16 },
  title: { ...typography.displaySerif, color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: -10 },

  grid: { gap: 12 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultInfo: { flex: 1, gap: 2 },
  resultName: { fontSize: 15, fontWeight: '600', color: colors.text },
  resultMeta: { fontSize: 12, color: colors.textMuted },
  resultWinner: { fontSize: 13, fontWeight: '600', color: colors.goldLight, maxWidth: 120 },

  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  upsellIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellText: { flex: 1, gap: 3 },
  upsellTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  upsellSubtitle: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
