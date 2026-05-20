import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { getMyStats, RecentSessionDto } from '../api/statsApi';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatPL(value: number): string {
  const abs = Math.abs(Math.round(value));
  return `${value >= 0 ? '+' : '-'}₪${abs.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AllSessionsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<RecentSessionDto[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const stats = await getMyStats(token);
      setSessions(stats.recentSessions);
    } catch {
      setError('Failed to load sessions. Tap to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  function openSession(s: RecentSessionDto) {
    navigation.navigate('Session', { sessionId: s.sessionId, groupId: s.groupId ?? '' });
  }

  const active   = sessions.filter(s => s.status === 'Active');
  const finished = sessions.filter(s => s.status === 'Finished');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      {/* ── Active ── */}
      <Text style={styles.sectionLabel}>Active Now</Text>
      {active.length === 0 ? (
        <TouchableOpacity
          style={styles.newGameCta}
          onPress={() => navigation.navigate('NewGame', {})}
          activeOpacity={0.85}
        >
          <Text style={styles.newGameCtaText}>♠  Start New Game</Text>
          <Text style={styles.newGameCtaChevron}>›</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.activeCard}>
          {active.map((s, i) => (
            <React.Fragment key={s.sessionId}>
              {i > 0 && <View style={styles.divider} />}
              <TouchableOpacity style={styles.activeRow} onPress={() => openSession(s)} activeOpacity={0.7}>
                <View style={styles.liveDot} />
                <View style={styles.rowLeft}>
                  <Text style={styles.sessionName}>{s.sessionName}</Text>
                  <Text style={styles.groupName}>{s.groupName}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* ── Recent ── */}
      <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Recent Sessions</Text>
      {finished.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardIcon}>🃏</Text>
          <Text style={styles.emptyText}>No sessions yet</Text>
          <Text style={styles.emptySubtext}>Finished games will appear here</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {finished.map((s, i) => {
            const pl = s.profitLoss;
            const plColor = pl != null && pl > 0 ? colors.success : pl != null && pl < 0 ? colors.error : colors.textMuted;
            return (
              <React.Fragment key={s.sessionId}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity style={styles.row} onPress={() => openSession(s)} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.sessionName}>{s.sessionName}</Text>
                    <Text style={styles.groupName}>{s.groupName}  ·  {formatDate(s.createdAt)}</Text>
                  </View>
                  {pl != null ? (
                    <Text style={[styles.plValue, { color: plColor }]}>{formatPL(pl)}</Text>
                  ) : (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  activeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 14,
    overflow: 'hidden',
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: { flex: 1, gap: 3 },
  sessionName: { fontSize: 15, fontWeight: '700', color: colors.text },
  groupName:   { fontSize: 12, color: colors.textMuted },
  plValue:     { fontSize: 14, fontWeight: '700' },
  chevron:     { fontSize: 20, color: colors.textDim, fontWeight: '300' },

  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },

  newGameCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  newGameCtaText: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.background },
  newGameCtaChevron: { fontSize: 24, color: 'rgba(15,25,35,0.6)', fontWeight: '300' },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center' as const,
  },
  emptyCardIcon: { fontSize: 28, marginBottom: 4 },
  emptyText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  emptySubtext: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center', marginHorizontal: 24 },
  retryBtn:  { borderWidth: 1, borderColor: colors.gold, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: colors.gold, fontWeight: '600' },
});
