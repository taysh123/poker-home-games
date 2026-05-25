import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { fadeIn, slideUp, pulse } from '../theme/motion';
import { getMyStats, MyStatsDto, RecentSessionDto } from '../api/statsApi';
import { getMyAchievements, AchievementDto, MyAchievementsDto } from '../api/achievementsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import SessionListItem from '../components/SessionListItem';
import SkeletonCard from '../components/SkeletonCard';
import SkeletonRow from '../components/SkeletonRow';
import { formatPL, formatDate, formatDuration, formatMinutes } from '../utils/formatters';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CHART_HEIGHT = 80;

type Period = 'week' | 'month' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all',   label: 'All Time' },
];

export default function StatsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('all');
  const [stats, setStats] = useState<MyStatsDto | null>(null);
  const [achievements, setAchievements] = useState<MyAchievementsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entrance animation
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  const runEntrance = useCallback(() => {
    opacity.setValue(0);
    translateY.setValue(20);
    Animated.parallel([
      fadeIn(opacity, { duration: 350 }),
      slideUp(translateY, { duration: 350, from: 20 }),
    ]).start();
  }, []);

  const load = useCallback(async (isRefresh = false, p: Period = 'all') => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const data = await getMyStats(token, p === 'all' ? undefined : p);
      setStats(data);
      if (!isRefresh && p === 'all') {
        getMyAchievements(token).catch(() => null).then(setAchievements);
      }
    } catch {
      setError('Failed to load stats.');
    } finally {
      setLoading(false);
      setPeriodLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load(false, period);
    runEntrance();
  }, [load, runEntrance, period]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(true, period); }, [load, period]);

  const onPeriodChange = useCallback((p: Period) => {
    setPeriod(p);
    setPeriodLoading(true);
    const token = SecureStore.getItemAsync('accessToken').then(t => {
      if (!t) return;
      getMyStats(t, p === 'all' ? undefined : p)
        .then(data => { setStats(data); })
        .catch(() => {})
        .finally(() => setPeriodLoading(false));
    });
  }, []);

  const customHeader = (
    <View style={[statsHeaderStyles.header, { paddingTop: insets.top + 12 }]}>
      <Text style={statsHeaderStyles.title}>Stats</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.scroll}>
        {customHeader}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SkeletonCard height={180} borderRadius={20} style={{ marginBottom: 24 }} />
        <View style={{ marginBottom: 24 }}>
          <SkeletonCard height={12} borderRadius={6} style={{ width: '40%', marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SkeletonCard height={90} borderRadius={14} style={{ flex: 1 }} />
            <SkeletonCard height={90} borderRadius={14} style={{ flex: 1 }} />
            <SkeletonCard height={90} borderRadius={14} style={{ flex: 1 }} />
          </View>
        </View>
        <SkeletonCard height={190} borderRadius={16} style={{ marginBottom: 24 }} />
        <View style={{ marginBottom: 24 }}>
          <SkeletonCard height={12} borderRadius={6} style={{ width: '50%', marginBottom: 12 }} />
          <View style={styles.listCard}>
            <SkeletonRow isFirst />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        </View>
        </ScrollView>
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View style={styles.scroll}>
        {customHeader}
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textDim} />
          <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const plColor = stats.totalProfitLoss > 0 ? colors.success : stats.totalProfitLoss < 0 ? colors.error : colors.textMuted;
  const avgColor = stats.averageProfitLoss > 0 ? colors.success : stats.averageProfitLoss < 0 ? colors.error : colors.textMuted;
  const winRate = stats.totalSessionsPlayed > 0
    ? Math.round((stats.winsCount / stats.totalSessionsPlayed) * 100)
    : 0;
  const winRateColor = winRate >= 50 ? colors.success : colors.textMuted;

  const finishedSessions = stats.recentSessions.filter(s => s.status === 'Finished');
  const activeSessions = stats.recentSessions.filter(s => s.status === 'Active');

  return (
    <View style={styles.scroll}>
      {customHeader}
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.gold}
          progressBackgroundColor={colors.surface}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>

        {/* ── Period Picker ── */}
        <View style={periodStyles.row}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[periodStyles.tab, period === p.key && periodStyles.tabActive]}
              onPress={() => onPeriodChange(p.key)}
              activeOpacity={0.7}
            >
              <Text style={[periodStyles.tabText, period === p.key && periodStyles.tabTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Hero P&L ── */}
        <View style={[styles.heroCard, periodLoading && { opacity: 0.6 }]}>
          <View style={styles.heroInner}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>
                  {period === 'week' ? 'This Week P&L' : period === 'month' ? 'This Month P&L' : 'Lifetime P&L'}
                </Text>
                <Text style={[styles.heroAmount, { color: plColor }]} numberOfLines={1} adjustsFontSizeToFit>
                  {formatPL(stats.totalProfitLoss)}
                </Text>
              </View>
              <View style={styles.sessionCountBadge}>
                <Text style={styles.sessionCountNum}>{stats.totalSessionsPlayed}</Text>
                <Text style={styles.sessionCountLabel}>sessions</Text>
              </View>
            </View>

            {/* W/L/E segmented breakdown */}
            {stats.totalSessionsPlayed > 0 && (
              <View style={styles.winRateSection}>
                <View style={styles.winRateLabelRow}>
                  <Text style={styles.winRateLabel}>Record</Text>
                  <Text style={[styles.winRatePct, { color: winRateColor }]}>{winRate}% win rate</Text>
                </View>
                <View style={styles.breakdownTrack}>
                  {stats.winsCount > 0 && (
                    <View style={[styles.breakdownSegW, { flex: stats.winsCount }]} />
                  )}
                  {stats.breakEvenCount > 0 && (
                    <View style={[styles.breakdownSegE, { flex: stats.breakEvenCount }]} />
                  )}
                  {stats.lossesCount > 0 && (
                    <View style={[styles.breakdownSegL, { flex: stats.lossesCount }]} />
                  )}
                </View>
                <View style={styles.breakdownLegend}>
                  <View style={styles.breakdownLegendItem}>
                    <View style={[styles.breakdownDot, { backgroundColor: colors.success }]} />
                    <Text style={styles.breakdownLegendText}>{stats.winsCount} W</Text>
                  </View>
                  <View style={styles.breakdownLegendItem}>
                    <View style={[styles.breakdownDot, { backgroundColor: colors.textDim }]} />
                    <Text style={styles.breakdownLegendText}>{stats.breakEvenCount} E</Text>
                  </View>
                  <View style={styles.breakdownLegendItem}>
                    <View style={[styles.breakdownDot, { backgroundColor: colors.error }]} />
                    <Text style={styles.breakdownLegendText}>{stats.lossesCount} L</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
          {/* decorative */}
          <View style={styles.heroCorner} pointerEvents="none" />
        </View>

        {/* ── Key numbers ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Numbers</Text>
          <View style={styles.statsRow}>
            <HighlightCard
              label="Best Win"
              value={stats.biggestWin != null ? formatPL(stats.biggestWin) : '—'}
              valueColor={colors.success}
              icon="trending-up"
            />
            <HighlightCard
              label="Worst Loss"
              value={stats.biggestLoss != null ? formatPL(stats.biggestLoss) : '—'}
              valueColor={colors.error}
              icon="trending-down"
            />
            <HighlightCard
              label="Avg Session"
              value={stats.totalSessionsPlayed > 0 ? formatPL(stats.averageProfitLoss) : '—'}
              valueColor={avgColor}
              icon="pulse"
            />
            <HighlightCard
              label="Time Played"
              value={formatMinutes(stats.totalMinutesPlayed)}
              valueColor={colors.textMuted}
              icon="time-outline"
            />
          </View>
        </View>

        {/* ── Streak ── */}
        {(stats.currentStreak !== 0 || stats.longestWinStreak > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Streak</Text>
            <View style={streakStyles.row}>
              {stats.currentStreak !== 0 && (
                <View style={[streakStyles.card, stats.currentStreak > 0 ? streakStyles.cardWin : streakStyles.cardLoss]}>
                  <Text style={streakStyles.emoji}>{stats.currentStreak > 0 ? '🔥' : '❄️'}</Text>
                  <Text style={[streakStyles.value, { color: stats.currentStreak > 0 ? colors.success : colors.error }]}>
                    {Math.abs(stats.currentStreak)}
                  </Text>
                  <Text style={streakStyles.label}>
                    {stats.currentStreak > 0 ? 'WIN STREAK' : 'LOSS STREAK'}
                  </Text>
                </View>
              )}
              {stats.longestWinStreak > 0 && (
                <View style={streakStyles.card}>
                  <Text style={streakStyles.emoji}>🏆</Text>
                  <Text style={[streakStyles.value, { color: colors.goldLight }]}>{stats.longestWinStreak}</Text>
                  <Text style={streakStyles.label}>BEST STREAK</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── P&L Trend ── */}
        {finishedSessions.length >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>P&L Trend</Text>
            <PLBarChart sessions={finishedSessions.slice(-12)} />
          </View>
        )}

        {/* ── Active sessions ── */}
        {activeSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Live Now</Text>
            <View style={styles.listCard}>
              {activeSessions.map((s, i) => (
                <SessionListItem
                  key={s.sessionId}
                  name={s.sessionName}
                  meta={[s.groupName, formatDate(s.createdAt)].filter(Boolean).join('  ·  ')}
                  profitLoss={s.profitLoss}
                  status={s.status}
                  onPress={() => navigation.navigate('Session', { sessionId: s.sessionId, groupId: s.groupId ?? '' })}
                  isFirst={i === 0}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Session history ── */}
        {finishedSessions.length > 0 && (
          <View style={[styles.section, styles.lastSection]}>
            <Text style={styles.sectionTitle}>Session History</Text>
            <View style={styles.listCard}>
              {finishedSessions.map((s, i) => (
                <SessionListItem
                  key={s.sessionId}
                  name={s.sessionName}
                  meta={[
                    s.groupName,
                    formatDate(s.createdAt),
                    s.startedAt && s.endedAt ? formatDuration(s.startedAt, s.endedAt) : null,
                  ].filter(Boolean).join('  ·  ')}
                  profitLoss={s.profitLoss}
                  status={s.status}
                  onPress={() => navigation.navigate('Session', { sessionId: s.sessionId, groupId: s.groupId ?? '' })}
                  isFirst={i === 0}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Achievements ── */}
        {achievements && (achievements.earned.length > 0 || achievements.locked.length > 0) && (
          <View style={[styles.section, styles.lastSection]}>
            <View style={achStyles.headerRow}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              {achievements.earned.length > 0 && (
                <Text style={achStyles.earnedCount}>{achievements.earned.length} earned</Text>
              )}
            </View>
            {achievements.earned.length > 0 && (
              <View style={achStyles.grid}>
                {achievements.earned.map((a) => (
                  <AchievementBadge key={a.key} achievement={a} earned />
                ))}
              </View>
            )}
            {achievements.locked.length > 0 && (
              <>
                {achievements.earned.length > 0 && <View style={achStyles.divider} />}
                <Text style={achStyles.lockedLabel}>Locked</Text>
                <View style={achStyles.grid}>
                  {achievements.locked.map((a) => (
                    <AchievementBadge key={a.key} achievement={a} earned={false} />
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {stats.totalSessionsPlayed === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="bar-chart-outline" size={32} color={colors.textDim} />
            </View>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySubtitle}>Play your first session to see stats here</Text>
          </View>
        )}

      </Animated.View>
    </ScrollView>
    </View>
  );
}

function HighlightCard({
  label,
  value,
  valueColor,
  icon,
}: {
  label: string;
  value: string;
  valueColor: string;
  icon: string;
}) {
  return (
    <View style={hlStyles.card}>
      <Ionicons name={icon as any} size={16} color={valueColor} style={hlStyles.icon} />
      <Text style={[hlStyles.value, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={hlStyles.label}>{label}</Text>
    </View>
  );
}

const hlStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
    gap: 4,
    ...shadows.sm,
  },
  icon: { marginBottom: 2 },
  value: {
    ...typography.amount,
    letterSpacing: -0.5,
  },
  label: {
    ...typography.caps,
    color: colors.textMuted,
    marginTop: 2,
  },
});

function PLBarChart({ sessions }: { sessions: RecentSessionDto[] }) {
  const maxAbs = Math.max(...sessions.map(s => Math.abs(s.profitLoss ?? 0)), 1);
  const periodNet = sessions.reduce((sum, s) => sum + (s.profitLoss ?? 0), 0);
  const periodColor = periodNet > 0 ? colors.success : periodNet < 0 ? colors.error : colors.textMuted;

  return (
    <View style={chartStyles.card}>
      <View style={chartStyles.cardHeader}>
        <Text style={chartStyles.cardHeaderTitle}>Last {sessions.length} sessions</Text>
        <Text style={[chartStyles.cardHeaderNet, { color: periodColor }]}>
          {periodNet > 0 ? '+' : ''}{formatPL(periodNet)}
        </Text>
      </View>
      <View style={chartStyles.bars}>
        {sessions.map((session, i) => {
          const v = session.profitLoss ?? 0;
          const barH = Math.max(Math.round((Math.abs(v) / maxAbs) * CHART_HEIGHT), 4);
          const isPos = v >= 0;
          return (
            <View key={i} style={chartStyles.col}>
              <View style={chartStyles.halfTop}>
                {isPos && (
                  <View style={[chartStyles.bar, {
                    height: barH,
                    backgroundColor: colors.success + 'CC',
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                  }]} />
                )}
              </View>
              <View style={chartStyles.zeroLine} />
              <View style={chartStyles.halfBot}>
                {!isPos && (
                  <View style={[chartStyles.bar, {
                    height: barH,
                    backgroundColor: colors.error + 'CC',
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    borderBottomLeftRadius: 4,
                    borderBottomRightRadius: 4,
                  }]} />
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View style={chartStyles.labelRow}>
        <View style={chartStyles.axisLegend}>
          <View style={[chartStyles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={chartStyles.axisLabel}>Win</Text>
        </View>
        <View style={chartStyles.axisLegend}>
          <View style={[chartStyles.legendDot, { backgroundColor: colors.error }]} />
          <Text style={chartStyles.axisLabel}>Loss</Text>
        </View>
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardHeaderNet: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bars: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'stretch',
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  halfTop: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  halfBot: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  zeroLine: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
  },
  bar: {
    width: '75%',
  },
  labelRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  axisLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  axisLabel: {
    ...typography.caps,
    color: colors.textDim,
    fontSize: 9,
  },
});

const streakStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  cardWin: { borderColor: colors.success + '44', backgroundColor: colors.surface },
  cardLoss: { borderColor: colors.error + '44', backgroundColor: colors.surface },
  emoji: { fontSize: 24, marginBottom: 2 },
  value: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] as const },
  label: { fontSize: 9, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' as const },
});

const RARITY_COLORS: Record<string, string> = {
  Common: colors.textMuted,
  Rare: '#4EAADC',
  Epic: '#C46EE8',
  Legendary: colors.gold,
};

function AchievementBadge({ achievement, earned }: { achievement: AchievementDto; earned: boolean }) {
  const rarityColor = RARITY_COLORS[achievement.rarity] ?? colors.textMuted;
  return (
    <View style={[achStyles.badge, !earned && achStyles.badgeLocked]}>
      <View style={[achStyles.iconCircle, { borderColor: earned ? rarityColor + '66' : colors.border }]}>
        <Ionicons
          name={achievement.iconKey as any}
          size={20}
          color={earned ? rarityColor : colors.textDim}
        />
      </View>
      <Text style={[achStyles.badgeName, !earned && achStyles.badgeNameLocked]} numberOfLines={1}>
        {achievement.name}
      </Text>
    </View>
  );
}

const periodStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.goldFaint,
    borderColor: colors.goldMuted,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.goldLight,
  },
});

const achStyles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  earnedCount: { fontSize: 11, fontWeight: '600', color: colors.gold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    width: '30%',
    minWidth: 90,
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  badgeLocked: { opacity: 0.45 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: { fontSize: 10, fontWeight: '700', color: colors.textHigh, textAlign: 'center' },
  badgeNameLocked: { color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  lockedLabel: { fontSize: 10, fontWeight: '600', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
});

const statsHeaderStyles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
});

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 120 },

  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { ...typography.labelSmall, color: colors.textMuted },

  // ── Hero Card ─────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    marginBottom: 24,
    overflow: 'hidden',
    ...shadows.md,
  },
  heroInner: { padding: 24 },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroLabel: {
    ...typography.caps,
    color: colors.textMuted,
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  sessionCountBadge: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    minWidth: 70,
  },
  sessionCountNum: {
    ...typography.h2,
    color: colors.text,
  },
  sessionCountLabel: {
    ...typography.caps,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Win rate / breakdown
  winRateSection: { gap: 8 },
  winRateLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  winRateLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  winRatePct: {
    ...typography.labelSmall,
    fontVariant: ['tabular-nums'],
  },
  // segmented breakdown track
  breakdownTrack: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
  },
  breakdownSegW: { height: 8, backgroundColor: colors.success + 'AA', borderRadius: 4 },
  breakdownSegL: { height: 8, backgroundColor: colors.error + 'AA', borderRadius: 4 },
  breakdownSegE: { height: 8, backgroundColor: colors.textDim + 'AA', borderRadius: 4 },
  breakdownLegend: {
    flexDirection: 'row',
    gap: 14,
  },
  breakdownLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  breakdownDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  breakdownLegendText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  heroCorner: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.goldFaint,
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: { marginBottom: 24 },
  lastSection: { marginBottom: 0 },
  sectionTitle: {
    ...typography.caps,
    color: colors.textMuted,
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  statsRow: { flexDirection: 'row', gap: 10 },

  listCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.sm,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { ...typography.h4, color: colors.text },
  emptySubtitle: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },
});
