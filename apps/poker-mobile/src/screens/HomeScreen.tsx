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
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getMyGroups, getMyInvitations, MyGroupDto, PendingInvitationDto } from '../api/groupsApi';
import { getMyStats, MyStatsDto } from '../api/statsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import SkeletonCard from '../components/SkeletonCard';

type HomeNav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatProfitLoss(value: number): string {
  const abs = Math.abs(Math.round(value));
  return `${value >= 0 ? '+' : '-'}₪${abs.toLocaleString()}`;
}


export default function HomeScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<HomeNav>();

  const [loggingOut, setLoggingOut]     = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const [groups, setGroups]             = useState<MyGroupDto[]>([]);
  const [stats, setStats]               = useState<MyStatsDto | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [invitations, setInvitations]   = useState<PendingInvitationDto[]>([]);
  const [refreshing, setRefreshing]     = useState(false);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setStatsLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const [groupsData, statsData, invData] = await Promise.all([
        getMyGroups(token),
        getMyStats(token),
        getMyInvitations(token),
      ]);
      setGroups(groupsData);
      setStats(statsData);
      setInvitations(invData);
    } catch {
      // silently ignore — home screen is non-critical
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll(true);
  }, [loadAll]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  function handleSessionPress(sessionId: string, groupId: string) {
    navigation.navigate('Session', { sessionId, groupId });
  }

  const initial = user?.username?.[0]?.toUpperCase() ?? '?';
  const previewGroups = groups.slice(0, 3);

  const activeSessions = stats?.recentSessions.filter(s => s.status === 'Active') ?? [];

  const plValue = stats?.totalProfitLoss ?? 0;
  const plColor = plValue > 0 ? colors.success : plValue < 0 ? colors.error : colors.gold;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
      }
    >
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.username}>{user?.username ?? 'Player'}</Text>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={[styles.logoutIcon, loggingOut && styles.logoutButtonDisabled]}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.7}
          >
            {loggingOut
              ? <ActivityIndicator color={colors.textMuted} size="small" />
              : <Text style={styles.logoutIconText}>→</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── New Game CTA ── */}
      <TouchableOpacity
        style={styles.newGameBtn}
        onPress={() => navigation.navigate('NewGame', {})}
        activeOpacity={0.85}
      >
        <Text style={styles.newGameIcon}>♠</Text>
        <Text style={styles.newGameText}>New Game</Text>
        <Text style={styles.newGameChevron}>›</Text>
      </TouchableOpacity>

      {/* ── Active Sessions — dominant, shown first ── */}
      {activeSessions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Now</Text>
          <View style={styles.activeCard}>
            {activeSessions.map((s, i) => (
              <React.Fragment key={s.sessionId}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.activeRow}
                  onPress={() => handleSessionPress(s.sessionId, s.groupId)}
                  activeOpacity={0.7}
                >
                  <Animated.View style={[styles.activePulse, { transform: [{ scale: pulseAnim }] }]} />
                  <View style={styles.activeRowLeft}>
                    <Text style={styles.activeSessionName}>{s.sessionName}</Text>
                    <Text style={styles.activeGroupName}>{s.groupName}</Text>
                  </View>
                  <Text style={styles.rowChevron}>›</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      {/* ── Quick Stats ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Stats</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AllSessions')}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>
        {statsLoading ? (
          <View style={styles.statsRow}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[styles.statCard, { justifyContent: 'center', gap: 6 }]}>
                <SkeletonCard height={20} borderRadius={6} style={{ marginHorizontal: 4 }} />
                <SkeletonCard height={12} borderRadius={4} style={{ marginHorizontal: 8 }} />
              </View>
            ))}
          </View>
        ) : (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {String(stats?.totalSessionsPlayed ?? 0)}
            </Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: plColor }]}>
              {`${plValue >= 0 ? '+' : ''}₪${Math.round(Math.abs(plValue)).toLocaleString()}`}
            </Text>
            <Text style={styles.statLabel}>Total P&L</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {stats?.biggestWin != null
                ? `+₪${Math.round(stats.biggestWin).toLocaleString()}`
                : '—'}
            </Text>
            <Text style={styles.statLabel}>Best Win</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{groups.length}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
        </View>
        )}
      </View>

      {/* ── Pending Invitations (only if any) ── */}
      {invitations.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Invitations</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Invitations')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.groupsCard}>
            {invitations.slice(0, 3).map((inv, i) => (
              <React.Fragment key={inv.invitationId}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.inviteRow}>
                  <View style={styles.groupRowLeft}>
                    <Text style={styles.groupRowName}>{inv.groupName}</Text>
                    <Text style={styles.groupRowMeta}>
                      Invited by {inv.invitedByUsername}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.viewInviteBtn}
                    onPress={() => navigation.navigate('Invitations')}
                  >
                    <Text style={styles.viewInviteBtnText}>View</Text>
                  </TouchableOpacity>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      {/* ── My Groups ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Groups</Text>
          {groups.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('GroupsList')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          )}
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>♠</Text>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySubtitle}>Create or join a poker group to get started</Text>
            <TouchableOpacity
              style={styles.createButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CreateGroup')}
            >
              <Text style={styles.createButtonText}>+ Create Group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.groupsCard}>
            {previewGroups.map((g, i) => (
              <React.Fragment key={g.id}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.groupRow}
                  onPress={() => navigation.navigate('GroupDetail', { groupId: g.id, groupName: g.name })}
                  activeOpacity={0.7}
                >
                  <View style={styles.groupRowLeft}>
                    <Text style={styles.groupRowName}>{g.name}</Text>
                    <Text style={styles.groupRowMeta}>
                      {g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.rowChevron}>›</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
            {groups.length > 3 && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.groupRow}
                  onPress={() => navigation.navigate('GroupsList')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moreGroupsText}>+{groups.length - 3} more groups</Text>
                  <Text style={styles.rowChevron}>›</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, paddingBottom: 48 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  topBarLeft: { flex: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greeting: {
    fontSize: 13,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  username: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.gold },
  logoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIconText: { fontSize: 18, color: colors.textMuted, lineHeight: 22 },
  logoutButtonDisabled: { opacity: 0.5 },

  newGameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 22,
    marginBottom: 28,
    gap: 12,
    shadowColor: colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  newGameIcon: { fontSize: 24 },
  newGameText: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.background },
  newGameChevron: { fontSize: 24, color: colors.background, fontWeight: '300' },

  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, color: colors.gold, fontWeight: '600' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.gold },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Active sessions
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
    paddingVertical: 12,
    gap: 10,
  },
  activePulse: {
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
  activeRowLeft: { flex: 1, gap: 2 },
  activeSessionName: { fontSize: 15, fontWeight: '700', color: colors.text },
  activeGroupName: { fontSize: 12, color: colors.textMuted },

  // Groups + sessions shared card style
  groupsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  groupRowLeft: { flex: 1, gap: 2 },
  groupRowName: { fontSize: 15, fontWeight: '700', color: colors.text },
  groupRowMeta: { fontSize: 12, color: colors.textMuted },
  rowChevron: { fontSize: 20, color: colors.textDim, fontWeight: '300' },
  moreGroupsText: { flex: 1, fontSize: 14, color: colors.textMuted },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewInviteBtn: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  viewInviteBtnText: { fontSize: 12, color: colors.gold, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },

  // Session row extras
  sessionNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionPl: { fontSize: 14, fontWeight: '700' },
  statusBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderColor: colors.gold,
  },
  badgeNeutral: {
    backgroundColor: 'rgba(58,74,90,0.5)',
    borderColor: colors.border,
  },
  statusBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  badgeActiveText: { color: colors.gold },
  badgeNeutralText: { color: colors.textMuted },

  // Empty states
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 36, color: colors.gold, marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  createButton: {
    marginTop: 16,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  createButtonText: { fontSize: 14, fontWeight: '700', color: colors.background },
});
