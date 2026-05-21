import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { fadeIn, slideUp, pulse } from '../theme/motion';
import { getMyStats, MyStatsDto, RecentSessionDto } from '../api/statsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import SessionListItem from '../components/SessionListItem';
import { formatPL, formatDate, formatDuration } from '../utils/formatters';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CHART_HEIGHT = 64;

export default function StatsScreen() {
  const navigation = useNavigation<Nav>();
  const [stats, setStats] = useState<MyStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const data = await getMyStats(token);
      setStats(data);
    } catch {
      setError('Failed to load stats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    runEntrance();
  }, [load, runEntrance]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.textDim} />
        <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
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
    <ScrollView
      style={styles.scroll}
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

        {/* ── Hero P&L ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroInner}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>Lifetime P&L</Text>
                <Text style={[styles.heroAmount, { color: plColor }]} numberOfLines={1} adjustsFontSizeToFit>
                  {formatPL(stats.totalProfitLoss)}
                </Text>
              </View>
              <View style={styles.sessionCountBadge}>
                <Text style={styles.sessionCountNum}>{stats.totalSessionsPlayed}</Text>
                <Text style={styles.sessionCountLabel}>sessions</Text>
              </View>
            </View>

            {/* Win rate bar */}
            {stats.totalSessionsPlayed > 0 && (
              <View style={styles.winRateSection}>
                <View style={styles.winRateLabelRow}>
                  <Text style={styles.winRateLabel}>Win rate</Text>
                  <Text style={[styles.winRatePct, { color: winRateColor }]}>{winRate}%</Text>
                </View>
                <View style={styles.winRateTrack}>
                  <Animated.View
                    style={[
                      styles.winRateFill,
                      { width: `${winRate}%` as any, backgroundColor: winRateColor },
                    ]}
                  />
                </View>
                <View style={styles.winRateRow}>
                  <Text style={styles.winRateStat}>
                    <Text style={{ color: colors.success }}>{stats.winsCount}W</Text>
                    {'  '}
                    <Text style={{ color: colors.error }}>{stats.lossesCount}L</Text>
                    {'  '}
                    <Text style={{ color: colors.textMuted }}>{stats.breakEvenCount}E</Text>
                  </Text>
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
          </View>
        </View>

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

  return (
    <View style={chartStyles.card}>
      <View style={chartStyles.bars}>
        {sessions.map((session, i) => {
          const v = session.profitLoss ?? 0;
          const barH = Math.max(Math.round((Math.abs(v) / maxAbs) * CHART_HEIGHT), 4);
          const isPos = v >= 0;
          return (
            <View key={i} style={chartStyles.col}>
              <View style={chartStyles.halfTop}>
                {isPos && (
                  <View style={[chartStyles.bar, { height: barH, backgroundColor: colors.success + 'CC' }]} />
                )}
              </View>
              <View style={chartStyles.zeroLine} />
              <View style={chartStyles.halfBot}>
                {!isPos && (
                  <View style={[chartStyles.bar, { height: barH, backgroundColor: colors.error + 'CC' }]} />
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View style={chartStyles.labelRow}>
        <Text style={chartStyles.axisLabel}>Loss</Text>
        <Text style={chartStyles.axisCenter}>P&L per session</Text>
        <Text style={chartStyles.axisLabel}>Win</Text>
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
    paddingTop: 20,
    paddingBottom: 12,
    ...shadows.sm,
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
    borderRadius: 3,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  axisLabel: {
    ...typography.caps,
    color: colors.textDim,
    fontSize: 9,
  },
  axisCenter: {
    ...typography.caps,
    color: colors.textMuted,
    fontSize: 9,
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

  // Win rate
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
  winRateTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  winRateFill: {
    height: 6,
    borderRadius: 3,
  },
  winRateRow: { marginTop: 2 },
  winRateStat: {
    ...typography.caption,
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
