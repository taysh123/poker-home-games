import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getMyGroups, getMyInvitations, MyGroupDto, PendingInvitationDto } from '../api/groupsApi';
import { getMyStats, MyStatsDto, RecentSessionDto } from '../api/statsApi';
import { getMyPendingSettlements, MyPendingSettlementDto } from '../api/settlementsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import SkeletonCard from '../components/SkeletonCard';
import { formatPL, formatDate, formatDuration } from '../utils/formatters';
import { useActiveSession } from '../context/ActiveSessionContext';

type HomeNav = NativeStackNavigationProp<RootStackParamList, 'Home'>;


export default function HomeScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<HomeNav>();
  const insets = useSafeAreaInsets();
  const { refresh: refreshActiveSession } = useActiveSession();

  const [loggingOut, setLoggingOut] = useState(false);
  const [groups, setGroups] = useState<MyGroupDto[]>([]);
  const [stats, setStats] = useState<MyStatsDto | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [invitations, setInvitations] = useState<PendingInvitationDto[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<MyPendingSettlementDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Pulse animation for the LIVE badge
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setStatsLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const [groupsData, statsData, invData, pendingData] = await Promise.all([
        getMyGroups(token),
        getMyStats(token),
        getMyInvitations(token),
        getMyPendingSettlements(token).catch(() => [] as MyPendingSettlementDto[]),
      ]);
      setGroups(groupsData);
      setStats(statsData);
      setInvitations(invData);
      setPendingSettlements(pendingData);
    } catch {
      // silent — home screen degrades gracefully
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadAll(); refreshActiveSession(); }, [loadAll, refreshActiveSession]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll(true);
  }, [loadAll]);

  async function handleLogout() {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  }

  function openSession(s: RecentSessionDto) {
    navigation.navigate('Session', { sessionId: s.sessionId, groupId: s.groupId ?? '' });
  }

  const initial = user?.username?.[0]?.toUpperCase() ?? '?';
  const activeSessions = stats?.recentSessions.filter(s => s.status === 'Active') ?? [];
  const recentSessions = stats?.recentSessions.filter(s => s.status === 'Finished').slice(0, 3) ?? [];

  const plValue = stats?.totalProfitLoss ?? 0;
  const plColor = plValue > 0 ? colors.success : plValue < 0 ? colors.error : colors.textMuted;
  const winRate = stats && stats.totalSessionsPlayed > 0
    ? Math.round((stats.winsCount / stats.totalSessionsPlayed) * 100)
    : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>♠ T Poker</Text>
          <Text style={styles.username} numberOfLines={1}>{user?.username ?? 'Player'}</Text>
        </View>
        <View style={styles.headerRight}>
          {invitations.length > 0 && (
            <TouchableOpacity
              style={styles.inviteBadge}
              onPress={() => navigation.navigate('Invitations')}
              activeOpacity={0.7}
            >
              <Text style={styles.inviteBadgeText}>{invitations.length}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.logoutBtn, loggingOut && { opacity: 0.5 }]}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.7}
          >
            {loggingOut
              ? <ActivityIndicator color={colors.textMuted} size="small" />
              : <Text style={styles.logoutBtnText}>→</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Active Game Banner (shown only when a live game exists) ── */}
      {activeSessions.map(s => (
        <TouchableOpacity
          key={s.sessionId}
          style={styles.liveBanner}
          onPress={() => openSession(s)}
          activeOpacity={0.85}
        >
          <View style={styles.liveBannerLeft}>
            <View style={styles.livePillRow}>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
            <Text style={styles.liveBannerName} numberOfLines={1}>{s.sessionName}</Text>
            <Text style={styles.liveBannerMeta}>
              {s.groupName ?? 'Solo Game'}  ·  Active now
            </Text>
          </View>
          <Text style={styles.liveBannerChevron}>›</Text>
        </TouchableOpacity>
      ))}

      {/* ── Pending Settlements Alert (shown only when user has pending payments) ── */}
      {pendingSettlements.length > 0 && (
        <TouchableOpacity
          style={styles.settlementsAlert}
          onPress={() => navigation.navigate('PendingSettlements')}
          activeOpacity={0.8}
        >
          <View style={styles.settlementsAlertLeft}>
            <Text style={styles.settlementsAlertIcon}>💸</Text>
            <View>
              <Text style={styles.settlementsAlertTitle}>
                {pendingSettlements.length} pending settlement{pendingSettlements.length !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.settlementsAlertSub}>Tap to view and mark as paid</Text>
            </View>
          </View>
          <Text style={styles.settlementsAlertChevron}>›</Text>
        </TouchableOpacity>
      )}

      {/* ── New Game CTA ── */}
      <TouchableOpacity
        style={styles.newGameCard}
        onPress={() => navigation.navigate('NewGame', {})}
        activeOpacity={0.85}
      >
        <View style={styles.newGameCardInner}>
          <Text style={styles.newGameIcon}>♠</Text>
          <View style={styles.newGameTextBlock}>
            <Text style={styles.newGameTitle}>New Game</Text>
            <Text style={styles.newGameSub}>Deal in your crew for tonight</Text>
          </View>
        </View>
        <Text style={styles.newGameChevron}>›</Text>
      </TouchableOpacity>

      {/* ── Stats ── */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Stats')}>
            <Text style={styles.seeAll}>View all →</Text>
          </TouchableOpacity>
        </View>

        {statsLoading ? (
          <View style={styles.statsGrid}>
            {[0, 1, 2].map(i => (
              <View key={i} style={styles.statCard}>
                <SkeletonCard height={24} borderRadius={6} style={{ marginBottom: 6 }} />
                <SkeletonCard height={11} borderRadius={4} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.totalSessionsPlayed ?? 0}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={[styles.statCard, styles.statCardCenter]}>
              <Text style={[styles.statValue, { color: plColor }]}>
                {stats ? formatPL(plValue) : '—'}
              </Text>
              <Text style={styles.statLabel}>Lifetime P&L</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, winRate !== null && winRate >= 50 ? { color: colors.success } : {}]}>
                {winRate !== null ? `${winRate}%` : '—'}
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Recent Sessions ── */}
      {(statsLoading || recentSessions.length > 0) && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AllSessions')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          {statsLoading ? (
            <View style={styles.card}>
              {[0, 1, 2].map(i => (
                <View key={i} style={[styles.sessionRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <SkeletonCard height={14} borderRadius={4} style={{ width: '60%' }} />
                    <SkeletonCard height={11} borderRadius={4} style={{ width: '40%' }} />
                  </View>
                  <SkeletonCard height={14} borderRadius={4} style={{ width: 48 }} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.card}>
              {recentSessions.map((s, i) => {
                const pl = s.profitLoss;
                const plC = pl != null && pl > 0 ? colors.success : pl != null && pl < 0 ? colors.error : colors.textMuted;
                return (
                  <TouchableOpacity
                    key={s.sessionId}
                    style={[styles.sessionRow, i > 0 && styles.sessionRowBorder]}
                    onPress={() => openSession(s)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sessionRowLeft}>
                      <Text style={styles.sessionName} numberOfLines={1}>{s.sessionName}</Text>
                      <Text style={styles.sessionMeta}>
                        {s.groupName ?? 'Solo'}  ·  {formatDate(s.createdAt)}
                        {s.startedAt && s.endedAt ? `  ·  ${formatDuration(s.startedAt, s.endedAt)}` : ''}
                      </Text>
                    </View>
                    {pl != null && (
                      <Text style={[styles.sessionPL, { color: plC }]}>{formatPL(pl)}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── My Groups ── */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>My Groups</Text>
          {groups.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('GroupsList')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          )}
        </View>

        {statsLoading && groups.length === 0 ? (
          <View style={styles.card}>
            {[0, 1].map(i => (
              <View key={i} style={[styles.groupRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={{ flex: 1, gap: 6 }}>
                  <SkeletonCard height={14} borderRadius={4} style={{ width: '50%' }} />
                  <SkeletonCard height={11} borderRadius={4} style={{ width: '30%' }} />
                </View>
              </View>
            ))}
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>♣</Text>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySubtitle}>Create a group for your regular crew</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('CreateGroup')}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyBtnText}>+ Create Group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            {groups.slice(0, 3).map((g, i) => (
              <TouchableOpacity
                key={g.id}
                style={[styles.groupRow, i > 0 && styles.groupRowBorder]}
                onPress={() => navigation.navigate('GroupDetail', { groupId: g.id, groupName: g.name })}
                activeOpacity={0.7}
              >
                <View style={styles.groupAvatar}>
                  <Text style={styles.groupAvatarText}>{g.name[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={styles.groupRowContent}>
                  <Text style={styles.groupName} numberOfLines={1}>{g.name}</Text>
                  <Text style={styles.groupMeta}>
                    {g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
            {groups.length > 3 && (
              <TouchableOpacity
                style={[styles.groupRow, styles.groupRowBorder]}
                onPress={() => navigation.navigate('GroupsList')}
                activeOpacity={0.7}
              >
                <Text style={styles.moreText}>+{groups.length - 3} more groups</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 48 },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  brand: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.gold },

  inviteBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBadgeText: { fontSize: 12, fontWeight: '800', color: colors.background },

  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: { fontSize: 17, color: colors.textMuted },

  // ── Live Banner ──────────────────────────────────────────────────────────
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.gold,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  liveBannerLeft: { flex: 1, gap: 4 },
  livePillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  livePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1.5,
  },
  liveBannerName: { fontSize: 17, fontWeight: '700', color: colors.text },
  liveBannerMeta: { fontSize: 12, color: colors.textMuted },
  liveBannerChevron: { fontSize: 28, color: colors.gold, fontWeight: '300', marginLeft: 8 },

  // ── Settlements Alert ────────────────────────────────────────────────────
  settlementsAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.4)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 12,
  },
  settlementsAlertLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settlementsAlertIcon: { fontSize: 22 },
  settlementsAlertTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  settlementsAlertSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  settlementsAlertChevron: { fontSize: 22, color: colors.textDim, fontWeight: '300' },

  // ── New Game Card ────────────────────────────────────────────────────────
  newGameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  newGameCardInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  newGameIcon: { fontSize: 28 },
  newGameTextBlock: { gap: 2 },
  newGameTitle: { fontSize: 18, fontWeight: '800', color: colors.background },
  newGameSub: { fontSize: 13, color: 'rgba(15,25,35,0.65)', fontWeight: '500' },
  newGameChevron: { fontSize: 28, color: 'rgba(15,25,35,0.6)', fontWeight: '300' },

  // ── Sections ────────────────────────────────────────────────────────────
  section: { marginBottom: 28 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  seeAll: { fontSize: 13, color: colors.gold, fontWeight: '600' },

  // ── Stats grid ──────────────────────────────────────────────────────────
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 5,
  },
  statCardCenter: {
    borderColor: colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },

  // ── Shared card container ────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },

  // ── Session rows ─────────────────────────────────────────────────────────
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  sessionRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  sessionRowLeft: { flex: 1, gap: 3 },
  sessionName: { fontSize: 15, fontWeight: '600', color: colors.text },
  sessionMeta: { fontSize: 12, color: colors.textMuted },
  sessionPL: { fontSize: 14, fontWeight: '700' },

  // ── Group rows ───────────────────────────────────────────────────────────
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  groupRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  groupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  groupRowContent: { flex: 1, gap: 2 },
  groupName: { fontSize: 15, fontWeight: '600', color: colors.text },
  groupMeta: { fontSize: 12, color: colors.textMuted },
  chevron: { fontSize: 20, color: colors.textDim, fontWeight: '300' },
  moreText: { flex: 1, fontSize: 14, color: colors.textMuted },

  // ── Empty state ──────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 32, color: colors.textDim, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: colors.background },
});
