import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getMyStats, MyStatsDto, RecentSessionDto } from '../api/statsApi';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatPL(value: number): string {
  const abs = Math.abs(Math.round(value));
  return `${value >= 0 ? '+' : '-'}₪${abs.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function StatsScreen() {
  const navigation = useNavigation<Nav>();
  const [stats, setStats] = useState<MyStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const plColor = stats.totalProfitLoss > 0 ? colors.success : stats.totalProfitLoss < 0 ? colors.error : colors.gold;
  const avgColor = stats.averageProfitLoss > 0 ? colors.success : stats.averageProfitLoss < 0 ? colors.error : colors.textMuted;
  const winRate = stats.totalSessionsPlayed > 0
    ? Math.round((stats.winsCount / stats.totalSessionsPlayed) * 100)
    : 0;

  const finishedSessions = stats.recentSessions.filter(s => s.status === 'Finished');
  const activeSessions   = stats.recentSessions.filter(s => s.status !== 'Finished');

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      {/* ── Total P&L hero ── */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>LIFETIME P&L</Text>
        <Text style={[styles.heroAmount, { color: plColor }]}>
          {formatPL(stats.totalProfitLoss)}
        </Text>
        <Text style={styles.heroSub}>{stats.totalSessionsPlayed} sessions played</Text>
      </View>

      {/* ── Win / Loss record ── */}
      <Text style={styles.sectionTitle}>RECORD</Text>
      <View style={styles.recordCard}>
        <RecordCell label="Wins" value={stats.winsCount} color={colors.success} />
        <View style={styles.recordDivider} />
        <RecordCell label="Losses" value={stats.lossesCount} color={colors.error} />
        <View style={styles.recordDivider} />
        <RecordCell label="Even" value={stats.breakEvenCount} color={colors.textMuted} />
        <View style={styles.recordDivider} />
        <RecordCell label="Win Rate" value={`${winRate}%`} color={winRate >= 50 ? colors.success : colors.textMuted} />
      </View>

      {/* ── Highlights ── */}
      <Text style={styles.sectionTitle}>HIGHLIGHTS</Text>
      <View style={styles.highlightsRow}>
        <HighlightCard
          label="Best Win"
          value={stats.biggestWin != null ? `+₪${Math.round(stats.biggestWin).toLocaleString()}` : '—'}
          valueColor={colors.success}
        />
        <HighlightCard
          label="Worst Loss"
          value={stats.biggestLoss != null ? `-₪${Math.abs(Math.round(stats.biggestLoss)).toLocaleString()}` : '—'}
          valueColor={colors.error}
        />
        <HighlightCard
          label="Avg Session"
          value={stats.totalSessionsPlayed > 0 ? formatPL(stats.averageProfitLoss) : '—'}
          valueColor={avgColor}
        />
      </View>

      {/* ── P&L chart (only when there are finished sessions) ── */}
      {finishedSessions.length >= 2 && (
        <>
          <Text style={styles.sectionTitle}>P&L TREND</Text>
          <PLBarChart sessions={finishedSessions.slice(-10)} />
        </>
      )}

      {/* ── Active sessions ── */}
      {activeSessions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>ACTIVE</Text>
          <View style={styles.listCard}>
            {activeSessions.map((s, i) => (
              <React.Fragment key={s.sessionId}>
                {i > 0 && <View style={styles.divider} />}
                <SessionRow session={s} onPress={() => navigation.navigate('Session', {
                  sessionId: s.sessionId,
                  groupId: s.groupId ?? '',
                })} />
              </React.Fragment>
            ))}
          </View>
        </>
      )}

      {/* ── Session history ── */}
      {finishedSessions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>SESSION HISTORY</Text>
          <View style={styles.listCard}>
            {finishedSessions.map((s, i) => (
              <React.Fragment key={s.sessionId}>
                {i > 0 && <View style={styles.divider} />}
                <SessionRow session={s} onPress={() => navigation.navigate('Session', {
                  sessionId: s.sessionId,
                  groupId: s.groupId ?? '',
                })} />
              </React.Fragment>
            ))}
          </View>
        </>
      )}

      {stats.totalSessionsPlayed === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>♠</Text>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySubtitle}>Play your first session to see stats here</Text>
        </View>
      )}
    </ScrollView>
  );
}

const CHART_HALF = 52;

function PLBarChart({ sessions }: { sessions: RecentSessionDto[] }) {
  const values = sessions.map(s => s.profitLoss ?? 0);
  const maxAbs = Math.max(...values.map(Math.abs), 1);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartBars}>
        {values.map((v, i) => {
          const ratio = Math.abs(v) / maxAbs;
          const barH = Math.max(Math.round(ratio * CHART_HALF), 3);
          const isPos = v >= 0;
          return (
            <View key={i} style={styles.chartBarCol}>
              {/* Upper half — positive bars anchor to bottom */}
              <View style={styles.chartHalfTop}>
                {isPos && <View style={[styles.chartBarFill, styles.chartBarWin, { height: barH }]} />}
              </View>
              {/* Zero line */}
              <View style={styles.chartZeroLine} />
              {/* Lower half — negative bars anchor to top */}
              <View style={styles.chartHalfBot}>
                {!isPos && <View style={[styles.chartBarFill, styles.chartBarLoss, { height: barH }]} />}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function RecordCell({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.recordCell}>
      <Text style={[styles.recordValue, { color }]}>{value}</Text>
      <Text style={styles.recordLabel}>{label}</Text>
    </View>
  );
}

function HighlightCard({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <View style={styles.highlightCard}>
      <Text style={[styles.highlightValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.highlightLabel}>{label}</Text>
    </View>
  );
}

function SessionRow({ session, onPress }: { session: RecentSessionDto; onPress: () => void }) {
  const pl = session.profitLoss;
  const plColor = pl != null && pl > 0 ? colors.success : pl != null && pl < 0 ? colors.error : colors.textMuted;
  return (
    <TouchableOpacity style={styles.sessionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.sessionRowLeft}>
        <Text style={styles.sessionName} numberOfLines={1}>{session.sessionName}</Text>
        <Text style={styles.sessionMeta}>{session.groupName}  ·  {formatDate(session.createdAt)}</Text>
      </View>
      {pl != null ? (
        <Text style={[styles.sessionPL, { color: plColor }]}>{formatPL(pl)}</Text>
      ) : (
        <View style={styles.activeDot} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },

  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorText: { color: colors.error, fontSize: 15, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },

  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroAmount: { ...typography.hero },
  heroSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 2,
  },

  recordCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 20,
  },
  recordCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  recordDivider: { width: 1, backgroundColor: colors.border, marginVertical: 12 },
  recordValue: { fontSize: 20, fontWeight: '700' },
  recordLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  highlightsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  highlightCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  highlightValue: { fontSize: 16, fontWeight: '700' },
  highlightLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  listCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  sessionRowLeft: { flex: 1, gap: 3 },
  sessionName: { fontSize: 14, fontWeight: '600', color: colors.text },
  sessionMeta: { fontSize: 11, color: colors.textMuted },
  sessionPL: { fontSize: 14, fontWeight: '700' },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },

  chartCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 16,
    marginBottom: 20,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
  },
  chartBarCol: {
    flex: 1,
    alignItems: 'center',
  },
  chartHalfTop: {
    height: CHART_HALF,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartHalfBot: {
    height: CHART_HALF,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  chartZeroLine: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
  },
  chartBarFill: {
    width: '70%',
    borderRadius: 3,
  },
  chartBarWin: { backgroundColor: colors.success },
  chartBarLoss: { backgroundColor: colors.error },

  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  emptyIcon: { fontSize: 40, color: colors.gold, marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
