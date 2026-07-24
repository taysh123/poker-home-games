import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  findNodeHandle,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Share,
  Platform,
  Animated,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { USE_NATIVE_DRIVER } from '../theme/motion';
import { LinearGradient } from 'expo-linear-gradient';
import { showToast } from '../utils/toast';
import { confirmDialog } from '../utils/confirm';
import { typography } from '../theme/typography';
import { successNotification } from '../utils/haptics';
import PressableScale from '../components/motion/PressableScale';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import {
  getGroupById,
  getGroupMembers,
  getGroupLeaderboard,
  getGroupRivals,
  GroupDetailResponse,
  GroupMemberDto,
  PlayerLeaderboardEntryDto,
  GroupRivalryDto,
  sendGroupInvitation,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
  generateGroupInviteLink,
} from '../api/groupsApi';
import { getGroupActivity, ActivityLogDto } from '../api/activityApi';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { searchUsers, UserSearchResultDto } from '../api/usersApi';
import SkeletonCard from '../components/SkeletonCard';
import SkeletonRow from '../components/SkeletonRow';
import Screen from '../components/Screen';
import BrandHeader from '../components/BrandHeader';
import Avatar from '../components/Avatar';
import Chip from '../components/Chip';
import Segmented from '../components/Segmented';
import ErrorState from '../components/ErrorState';
import InviteSheet from '../components/InviteSheet';
import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

const LB_PERIODS = ['week', 'month', 'all'] as const;
const LB_PERIOD_LABELS = ['Week', 'Month', 'All Time'];
// Podium accents — gold maps to the DS token; silver/bronze have no DS token
// (mirrors the local RANK_COLORS in SessionScreen, the polished reference).
const RANK_SILVER = '#8DA9C4';
const RANK_BRONZE = '#B87333';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId, groupName, showInviteOnLoad, focusLeaderboard } = route.params;
  const { user } = useAuth();
  const hasAutoInvited = React.useRef(false);

  const [group, setGroup] = useState<GroupDetailResponse | null>(null);
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [leaderboard, setLeaderboard] = useState<PlayerLeaderboardEntryDto[]>([]);
  const [activity, setActivity] = useState<ActivityLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<UserSearchResultDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [rivals, setRivals] = useState<GroupRivalryDto[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [qrInvite, setQrInvite] = useState<{ url: string; expiresAt?: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lbPeriod, setLbPeriod] = useState<'week' | 'month' | 'all'>('all');
  const listRef = useRef<FlatList>(null);
  const lbSectionRef = useRef<View>(null);
  const didFocusLb = useRef(false);
  const didScrollLb = useRef(false);
  // Mirrors lbPeriod for load()/useFocusEffect, whose useCallback([groupId]) would otherwise capture
  // a stale lbPeriod — so a refocus refetches the SELECTED period, never all-time under a Week label.
  const lbPeriodRef = useRef<'week' | 'month' | 'all'>('all');
  const [lbLoading, setLbLoading] = useState(false);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdminOrOwner = group?.myRole === 'Admin' || group?.myRole === 'Owner';
  const isOwner = group?.myRole === 'Owner';

  const reduced = useReducedMotion();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const [groupData, membersData, leaderboardData, activityData, rivalsData] = await Promise.all([
        getGroupById(token, groupId),
        getGroupMembers(token, groupId),
        getGroupLeaderboard(token, groupId, lbPeriodRef.current).catch(() => [] as PlayerLeaderboardEntryDto[]),
        getGroupActivity(token, groupId).catch(() => [] as ActivityLogDto[]),
        getGroupRivals(token, groupId).catch(() => [] as GroupRivalryDto[]),
      ]);
      setGroup(groupData);
      setMembers(membersData);
      setLeaderboard(leaderboardData);
      setActivity(activityData);
      // Initial fetch uses the server default page size (50, the max) —
      // a full page means there may be older entries to load.
      setActivityHasMore(activityData.length >= 50);
      setRivals(rivalsData);
    } catch {
      setError('Failed to load group details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  const loadMoreActivity = useCallback(async () => {
    if (activityLoadingMore) return;
    setActivityLoadingMore(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const take = 20;
      const page = await getGroupActivity(token, groupId, { skip: activity.length, take });
      setActivity(prev => [...prev, ...page]);
      if (page.length < take) setActivityHasMore(false);
    } catch {
      // silent — keep the button so the user can retry
    } finally {
      setActivityLoadingMore(false);
    }
  }, [groupId, activity.length, activityLoadingMore]);

  const loadLeaderboard = useCallback(async (period: 'week' | 'month' | 'all') => {
    setLbLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const data = await getGroupLeaderboard(token, groupId, period);
      setLeaderboard(data);
    } catch {
      // silent — leaderboard refresh failure is non-critical
    } finally {
      setLbLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(reduced ? 1 : 0);
      slideAnim.setValue(reduced ? 0 : 20);
      load().then(() => {
        if (reduced) { fadeAnim.setValue(1); slideAnim.setValue(0); return; }
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.spring(slideAnim, { toValue: 0, friction: 10, tension: 100, useNativeDriver: USE_NATIVE_DRIVER }),
        ]).start();
      });
    }, [load, reduced]),
  );

  const onRefresh = useCallback(() => { setRefreshing(true); void load(true); }, [load]);

  // Focus-leaderboard deep link (2.5): preselect the Week period + load it, once the screen is ready.
  React.useEffect(() => {
    if (!focusLeaderboard || didFocusLb.current || loading || !group) return;
    didFocusLb.current = true;
    setLbPeriod('week');
    lbPeriodRef.current = 'week';
    loadLeaderboard('week');
  }, [focusLeaderboard, loading, group, loadLeaderboard]);

  // Then scroll the leaderboard section into view once its Week rows have rendered.
  React.useEffect(() => {
    if (!didFocusLb.current || didScrollLb.current || lbLoading || lbPeriod !== 'week') return;
    didScrollLb.current = true;
    const t = setTimeout(() => {
      const scrollNode = findNodeHandle(listRef.current?.getScrollableNode?.() ?? null);
      if (scrollNode != null && lbSectionRef.current) {
        lbSectionRef.current.measureLayout(
          scrollNode,
          (_x, y) => listRef.current?.scrollToOffset({ offset: Math.max(0, y - 12), animated: true }),
          () => {},
        );
      }
    }, 250);
    return () => clearTimeout(t);
  }, [lbLoading, lbPeriod]);

  React.useEffect(() => {
    if (!showInviteOnLoad || hasAutoInvited.current || loading || !group) return;
    if (group.memberCount <= 1) {
      hasAutoInvited.current = true;
      confirmDialog(
        'Group Created!',
        `"${group.name}" is ready. Share the invite link so your friends can join.`,
        'Share Invite Link',
        handleShareInvite,
        { cancelLabel: 'Later' },
      );
    }
  }, [showInviteOnLoad, loading, group]);

  // Velvet Table header (brand home anchor + back + group title)
  const header = (
    <BrandHeader
      title={group?.name ?? groupName}
      onBack={() => navigation.goBack()}
      right={
        isAdminOrOwner ? (
          <PressableScale
            style={styles.headerEditBtn}
            onPress={() =>
              navigation.navigate('EditGroup', {
                groupId,
                groupName: group?.name ?? groupName,
                description: group?.description,
              })
            }
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Group settings"
          >
            <Ionicons name="settings-outline" size={iconSize.sm} color={colors.gold} />
          </PressableScale>
        ) : undefined
      }
    />
  );

  const handleInvite = async (usernameOverride?: string) => {
    const username = (usernameOverride ?? inviteUsername).trim();
    if (!username) return;
    try {
      setInviteLoading(true);
      setSearchResults([]);
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await sendGroupInvitation(token, groupId, username);
      setInviteUsername('');
      showToast(`${username} has been invited.`, 'success');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.title ??
        'Failed to send invitation.';
      showToast(msg, 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteSearch = (text: string) => {
    setInviteUsername(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (text.trim().length < 2) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (!token) return;
        const results = await searchUsers(token, text.trim());
        setSearchResults(results.slice(0, 5));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleRemoveMember = (member: GroupMemberDto) => {
    confirmDialog(
      'Remove Member',
      `Remove ${member.username} from the group?`,
      'Remove',
      async () => {
        try {
          setActionLoading(member.userId);
          const token = await SecureStore.getItemAsync('accessToken');
          if (!token) return;
          await removeGroupMember(token, groupId, member.userId);
          await load();
        } catch {
          showToast('Failed to remove member.', 'error');
        } finally {
          setActionLoading(null);
        }
      },
      { destructive: true },
    );
  };

  const handleLeaveGroup = () => {
    const name = group?.name ?? groupName;
    const soleMember = (group?.memberCount ?? 0) <= 1;
    const message = isOwner
      ? soleMember
        ? `You're the only member of ${name}. Leaving will delete this group and its history.`
        : `Leave ${name}? Ownership will pass to another member — the group stays for everyone else.`
      : `Are you sure you want to leave ${name}?`;
    confirmDialog(
      'Leave Group',
      message,
      'Leave',
      async () => {
        try {
          const token = await SecureStore.getItemAsync('accessToken');
          if (!token) return;
          await leaveGroup(token, groupId);
          navigation.goBack();
        } catch {
          showToast('Failed to leave group. Please try again.', 'error');
        }
      },
      { destructive: true },
    );
  };

  const handleDeleteGroup = () => {
    confirmDialog(
      'Delete Group',
      `Permanently delete "${group?.name ?? groupName}"? This cannot be undone. All sessions, members, and history will be removed.`,
      'Delete',
      async () => {
        try {
          const token = await SecureStore.getItemAsync('accessToken');
          if (!token) return;
          await deleteGroup(token, groupId);
          navigation.goBack();
        } catch {
          showToast('Failed to delete group. Please try again.', 'error');
        }
      },
      { destructive: true },
    );
  };

  const handleShowQr = async () => {
    setQrLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const result = await generateGroupInviteLink(token, groupId);
      setQrInvite({ url: result.deepLinkUrl, expiresAt: result.expiresAt });
    } catch {
      showToast('Failed to generate invite link. Please try again.', 'error');
    } finally {
      setQrLoading(false);
    }
  };

  const handleShareInvite = async () => {
    setShareLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const result = await generateGroupInviteLink(token, groupId);
      const url = result.deepLinkUrl;
      const message = `Join "${group?.name ?? groupName}" on T Poker: ${url}`;

      try {
        await Share.share({ message, url });
        successNotification();
      } catch {
        // Web desktop fallback: use Clipboard API
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          showToast('Invite link copied to clipboard!', 'success');
        } else {
          showToast('Could not open share sheet.', 'error');
        }
      }
    } catch {
      showToast('Failed to generate invite link. Please try again.', 'error');
    } finally {
      setShareLoading(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        {header}
        <View style={styles.listContent}>
          {/* group card */}
          <SkeletonCard height={88} borderRadius={16} style={{ marginBottom: 12 }} />
          {/* nav buttons */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <SkeletonCard height={52} borderRadius={14} style={{ flex: 1 }} />
            <SkeletonCard height={52} borderRadius={14} style={{ flex: 1 }} />
          </View>
          {/* members header */}
          <SkeletonCard height={14} borderRadius={4} style={{ width: '30%', marginBottom: 12 }} />
          {/* member rows */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            <SkeletonRow isFirst />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        </View>
      </Screen>
    );
  }

  if (error || !group) {
    return (
      <Screen>
        {header}
        <ErrorState message={error ?? 'Group not found.'} onRetry={load} />
      </Screen>
    );
  }

  const ownerId = group.ownerId;

  return (
    <Screen>
    {header}
    <Animated.View style={[styles.listWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
    <FlatList
      ref={listRef}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={members}
      keyExtractor={(item) => item.userId}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.gold}
          colors={[colors.gold]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerSection}>
          {/* Group info */}
          <View style={styles.groupCard}>
            <LinearGradient
              colors={[colors.goldFaint, 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.groupCardGlow}
              pointerEvents="none"
            />
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description ? (
              <Text style={styles.groupDesc}>{group.description}</Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
              </Text>
              {group.myRole ? (
                <>
                  <View style={styles.dot} />
                  <RoleBadge role={group.myRole} />
                </>
              ) : null}
            </View>
          </View>

          {/* Group stats chips */}
          {group.totalSessions > 0 && (
            <View style={styles.groupStatsRow}>
              <View style={styles.groupStatChip}>
                <Ionicons name="layers-outline" size={13} color={colors.textDim} />
                <Text style={styles.groupStatText}>{group.totalSessions} session{group.totalSessions !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.groupStatDivider} />
              <View style={styles.groupStatChip}>
                <Ionicons name="cash-outline" size={13} color={colors.textDim} />
                <Text style={styles.groupStatText}>₪{Math.round(group.totalMoneyMoved).toLocaleString()} moved</Text>
              </View>
            </View>
          )}

          {/* Nav buttons */}
          <View style={styles.navRow}>
            <PressableScale
              style={[styles.navButton, { flex: 1 }]}
              onPress={() =>
                navigation.navigate('SessionsList', {
                  groupId,
                  groupName,
                  userRole: group.myRole,
                })
              }
              haptic="light"
            >
              <View style={styles.navButtonInner}>
                <View style={styles.navIconWrap}>
                  <Ionicons name="layers-outline" size={18} color={colors.textMuted} />
                </View>
                <Text style={styles.navButtonText}>Sessions</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gold} />
            </PressableScale>
            {isAdminOrOwner && (
              <PressableScale
                style={[styles.navButton, styles.navButtonGold]}
                onPress={() => navigation.navigate('NewGame', { groupId, groupName })}
                haptic="medium"
              >
                <View style={styles.navButtonInner}>
                  <View style={[styles.navIconWrap, styles.navIconWrapGold]}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.gold} />
                  </View>
                  <Text style={styles.navButtonGoldText}>New Game</Text>
                </View>
              </PressableScale>
            )}
          </View>

          {/* ── Invite & Manage — Admin/Owner only, shown prominently above leaderboard ── */}
          {isAdminOrOwner && (
            <View style={styles.manageSection}>
              <Text style={styles.sectionTitle}>Manage Group</Text>

              {/* Share invite link */}
              <PressableScale
                style={styles.shareInviteBtn}
                onPress={handleShareInvite}
                disabled={shareLoading}
                haptic="light"
              >
                {shareLoading ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <>
                    <Ionicons name="share-outline" size={17} color={colors.gold} />
                    <Text style={styles.shareInviteText}>Share Invite Link</Text>
                  </>
                )}
              </PressableScale>

              {/* Show QR — additive; the one-tap Share above is unchanged */}
              <PressableScale
                style={[styles.shareInviteBtn, { marginTop: 10 }]}
                onPress={handleShowQr}
                disabled={qrLoading}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel="Show QR code to join"
              >
                {qrLoading ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <>
                    <Ionicons name="qr-code-outline" size={17} color={colors.gold} />
                    <Text style={styles.shareInviteText}>Show QR code</Text>
                  </>
                )}
              </PressableScale>

              <InviteSheet
                visible={!!qrInvite}
                onClose={() => setQrInvite(null)}
                kind="group"
                title={group?.name ?? groupName}
                url={qrInvite?.url ?? ''}
                expiresAt={qrInvite?.expiresAt}
              />

              {/* Invite by username */}
              <View style={styles.inviteSection}>
                <Text style={styles.inviteLabel}>Invite by username</Text>
                <View style={styles.inviteRow}>
                  <TextInput
                    style={styles.inviteInput}
                    value={inviteUsername}
                    onChangeText={handleInviteSearch}
                    placeholder="Search by username..."
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="send"
                    onSubmitEditing={() => handleInvite()}
                    editable={!inviteLoading}
                    accessibilityLabel="Invite by username"
                  />
                  <PressableScale
                    style={[
                      styles.inviteButton,
                      (!inviteUsername.trim() || inviteLoading) && styles.inviteButtonDisabled,
                    ]}
                    onPress={() => handleInvite()}
                    disabled={!inviteUsername.trim() || inviteLoading}
                    haptic="medium"
                    accessibilityRole="button"
                    accessibilityLabel="Send invitation"
                  >
                    {inviteLoading ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <Text style={styles.inviteButtonText}>Send</Text>
                    )}
                  </PressableScale>
                </View>
                {/* Search results dropdown */}
                {(searchLoading || searchResults.length > 0) && (
                  <View style={styles.searchDropdown}>
                    {searchLoading ? (
                      <View style={styles.searchDropdownItem}>
                        <ActivityIndicator size="small" color={colors.gold} />
                      </View>
                    ) : (
                      searchResults.map(r => (
                        <PressableScale
                          key={r.userId}
                          style={styles.searchDropdownItem}
                          onPress={() => handleInvite(r.username)}
                          haptic="light"
                          accessibilityRole="button"
                          accessibilityLabel={`Invite ${r.username}`}
                        >
                          <Avatar name={r.username} size={30} />
                          <Text style={styles.searchDropdownName}>{r.username}</Text>
                          <Text style={styles.searchDropdownInvite}>Invite →</Text>
                        </PressableScale>
                      ))
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Rivalries — promoted above leaderboard so social/competitive content is visible first */}
          {rivals.length > 0 && (
            <View style={styles.activitySection}>
              <Text style={styles.sectionTitle}>Rivalries</Text>
              <View style={styles.activityCard}>
                {rivals.map((r, i) => (
                  <MotiView key={`${r.player1Id}-${r.player2Id}`} {...slideUpSequence({ reduced, delay: staggerIn(i) })}>
                    {i > 0 && <View style={styles.activityDivider} />}
                    <RivalryRow rivalry={r} />
                  </MotiView>
                ))}
              </View>
            </View>
          )}

          {/* Leaderboard */}
          <View ref={lbSectionRef} style={styles.leaderboardSection}>
            <View style={styles.lbHeader}>
              <Text style={styles.sectionTitle}>Leaderboard</Text>
              {lbLoading && <ActivityIndicator size="small" color={colors.gold} />}
            </View>
            <Segmented
              style={styles.lbPeriod}
              options={LB_PERIOD_LABELS}
              selectedIndex={LB_PERIODS.indexOf(lbPeriod)}
              onChange={(i) => {
                const p = LB_PERIODS[i];
                setLbPeriod(p);
                lbPeriodRef.current = p;
                loadLeaderboard(p);
              }}
              accessibilityLabel="Leaderboard period"
            />
            {leaderboard.length > 0 ? (
              <View style={styles.leaderboardCard}>
                {leaderboard.map((entry, index) => (
                  <MotiView key={entry.userId} {...slideUpSequence({ reduced, delay: staggerIn(index) })}>
                    {index > 0 && <View style={styles.separator} />}
                    <PressableScale
                      haptic="light"
                      onPress={() => navigation.navigate('PlayerProfile', { userId: entry.userId, username: entry.username })}
                      accessibilityRole="button"
                      accessibilityLabel={`${entry.username}, rank ${index + 1}, view profile`}
                    >
                      <LeaderboardRow entry={entry} rank={index + 1} />
                    </PressableScale>
                  </MotiView>
                ))}
              </View>
            ) : (
              <View style={styles.lbEmpty}>
                <Text style={styles.lbEmptyText}>
                  {lbPeriod === 'all' ? 'No sessions recorded yet' : 'No sessions in this period'}
                </Text>
                {lbPeriod === 'all' && (
                  <PressableScale
                    style={styles.lbEmptyCta}
                    onPress={() => navigation.navigate('NewGame', { groupId, groupName })}
                    haptic="medium"
                    accessibilityRole="button"
                    accessibilityLabel="Start a game"
                  >
                    <Text style={styles.lbEmptyCtaText}>Start a Game →</Text>
                  </PressableScale>
                )}
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Members</Text>
        </View>
      }
      renderItem={({ item, index }) => {
        const isMemberOwner = item.userId === ownerId;
        const isCurrentUser = item.userId === user?.userId;
        const canRemove = isAdminOrOwner && !isMemberOwner && !isCurrentUser;
        return (
          <MotiView {...slideUpSequence({ reduced, delay: staggerIn(index) })}>
            <MemberRow
              member={item}
              canRemove={canRemove}
              isRemoving={actionLoading === item.userId}
              onRemove={() => handleRemoveMember(item)}
              onPress={() => navigation.navigate('PlayerProfile', { userId: item.userId, username: item.username ?? '' })}
            />
          </MotiView>
        );
      }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        <View style={styles.emptyMembers}>
          <Text style={styles.emptyMembersText}>No members yet.</Text>
        </View>
      }
      ListFooterComponent={
        <View>
          {activity.length > 0 && (
            <View style={styles.activitySection}>
              <View style={styles.activityHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <PressableScale
                  onPress={() => navigation.navigate('SessionsList', { groupId, groupName, userRole: group?.myRole ?? 'Member' })}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="See all sessions"
                >
                  <Text style={styles.seeAllLink}>See all →</Text>
                </PressableScale>
              </View>
              <View style={styles.activityCard}>
                {activity.map((item, i) => (
                  <MotiView key={item.id} {...slideUpSequence({ reduced, delay: staggerIn(i) })}>
                    {i > 0 && <View style={styles.activityDivider} />}
                    <ActivityRow
                      item={item}
                      onPress={item.relatedSessionId
                        ? () => navigation.navigate('Session', { sessionId: item.relatedSessionId!, groupId })
                        : undefined}
                    />
                  </MotiView>
                ))}
                {activityHasMore && (
                  <>
                    <View style={styles.activityDivider} />
                    <PressableScale
                      style={styles.activityLoadMoreRow}
                      onPress={loadMoreActivity}
                      disabled={activityLoadingMore}
                      haptic="light"
                      accessibilityRole="button"
                      accessibilityLabel="Load more activity"
                    >
                      {activityLoadingMore ? (
                        <ActivityIndicator size="small" color={colors.gold} />
                      ) : (
                        <Text style={styles.activityLoadMoreText}>Load more</Text>
                      )}
                    </PressableScale>
                  </>
                )}
              </View>
            </View>
          )}
          <PressableScale style={styles.leaveButton} onPress={handleLeaveGroup} haptic="light">
            <Ionicons name="exit-outline" size={16} color={colors.error} />
            <Text style={styles.leaveButtonText}>Leave Group</Text>
          </PressableScale>
          {isOwner && (
            <PressableScale style={styles.deleteGroupButton} onPress={handleDeleteGroup} haptic="light">
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.deleteGroupButtonText}>Delete Group</Text>
            </PressableScale>
          )}
        </View>
      }
    />
    </Animated.View>
    </Screen>
  );
}

type MemberRowProps = {
  member: GroupMemberDto;
  canRemove: boolean;
  isRemoving: boolean;
  onRemove: () => void;
  onPress: () => void;
};

function MemberRow({ member, canRemove, isRemoving, onRemove, onPress }: MemberRowProps) {
  return (
    <PressableScale
      style={styles.memberRow}
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${member.username}, view profile`}
    >
      <Avatar name={member.username ?? '?'} size={40} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.username}</Text>
        <Text style={styles.memberEmail}>{member.email}</Text>
      </View>
      <RoleBadge role={member.role} />
      {canRemove && (
        <PressableScale
          style={styles.removeButton}
          onPress={onRemove}
          disabled={isRemoving}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${member.username}`}
        >
          {isRemoving ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <View style={styles.removeIconWrap}>
              <Ionicons name="person-remove-outline" size={iconSize.xs} color={colors.error} />
            </View>
          )}
        </PressableScale>
      )}
    </PressableScale>
  );
}

const RANK_COLORS: Record<number, string> = {
  1: colors.gold,
  2: RANK_SILVER,
  3: RANK_BRONZE,
};

function LeaderboardRow({ entry, rank }: { entry: PlayerLeaderboardEntryDto; rank: number }) {
  const isPositive = entry.totalProfitLoss > 0;
  const isNegative = entry.totalProfitLoss < 0;
  const plColor = isPositive ? colors.success : isNegative ? colors.error : colors.textMuted;
  const plPrefix = isPositive ? '+' : '';
  const winRate = entry.sessionsPlayed > 0
    ? Math.round((entry.winsCount / entry.sessionsPlayed) * 100)
    : 0;
  const avgIsPos = entry.avgProfitLoss > 0;
  const avgIsNeg = entry.avgProfitLoss < 0;
  const avgColor = avgIsPos ? colors.success : avgIsNeg ? colors.error : colors.textMuted;
  const rankColor = RANK_COLORS[rank] ?? colors.textDim;

  return (
    <View style={[
      styles.leaderboardRow,
      rank === 1 && styles.leaderboardRowFirst,
      rank === 2 && styles.leaderboardRowSecond,
      rank === 3 && styles.leaderboardRowThird,
    ]}>
      <View style={[styles.rankBadge, { backgroundColor: rankColor + '22', borderColor: rankColor + '55' }]}>
        <Text style={[styles.lbRank, { color: rankColor }]}>{rank}</Text>
      </View>
      <Avatar name={entry.username ?? '?'} size={40} />
      <View style={styles.lbInfo}>
        <Text style={styles.lbUsername}>{entry.username}</Text>
        <Text style={styles.lbSessions}>
          {entry.sessionsPlayed} game{entry.sessionsPlayed !== 1 ? 's' : ''}
          {' · '}{winRate}% win
        </Text>
      </View>
      <View style={styles.lbRight}>
        <Text style={[styles.lbPL, { color: plColor }]}>
          {plPrefix}₪{Math.abs(Math.round(entry.totalProfitLoss)).toLocaleString()}
        </Text>
        <Text style={[styles.lbAvg, { color: avgColor }]}>
          avg {entry.avgProfitLoss >= 0 ? '+' : ''}₪{Math.abs(Math.round(entry.avgProfitLoss)).toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function activityIconName(type: string): { name: IoniconsName; color: string } {
  switch (type) {
    case 'SessionCreated': return { name: 'add-circle-outline', color: colors.gold };
    case 'SessionStarted': return { name: 'play-circle-outline', color: colors.success };
    case 'SessionEnded':   return { name: 'stop-circle-outline', color: colors.textMuted };
    case 'PlayerJoined':   return { name: 'person-add-outline', color: colors.gold };
    case 'DebtCreated':    return { name: 'cash-outline', color: colors.warning };
    case 'DebtSettled':    return { name: 'checkmark-circle-outline', color: colors.success };
    case 'MemberJoined':   return { name: 'enter-outline', color: colors.success };
    case 'MemberLeft':     return { name: 'exit-outline', color: colors.textMuted };
    case 'MemberRemoved':  return { name: 'person-remove-outline', color: colors.error };
    default:               return { name: 'ellipse-outline', color: colors.textDim };
  }
}

function ActivityRow({ item, onPress }: { item: ActivityLogDto; onPress?: () => void }) {
  const ago = (() => {
    const diff = Date.now() - new Date(item.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  const { name: iconName, color: iconColor } = activityIconName(item.type);

  const inner = (
    <>
      <View style={[styles.activityIconWrap, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={iconName} size={iconSize.xs} color={iconColor} />
      </View>
      <Text style={styles.activityDesc} numberOfLines={2}>{item.description}</Text>
      <Text style={styles.activityTime}>{ago}</Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.activityRow}>{inner}</View>;
  }

  return (
    <PressableScale
      style={styles.activityRow}
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={item.description}
    >
      {inner}
      <Ionicons name="chevron-forward" size={iconSize.xs} color={colors.textDim} />
    </PressableScale>
  );
}

function RivalryRow({ rivalry }: { rivalry: GroupRivalryDto }) {
  const { formatPL } = require('../utils/formatters');
  const leader = rivalry.player1NetPL >= rivalry.player2NetPL ? {
    name: rivalry.player1Username, pl: rivalry.player1NetPL,
    opName: rivalry.player2Username, opPl: rivalry.player2NetPL,
  } : {
    name: rivalry.player2Username, pl: rivalry.player2NetPL,
    opName: rivalry.player1Username, opPl: rivalry.player1NetPL,
  };
  const plColor = leader.pl > 0 ? colors.success : leader.pl < 0 ? colors.error : colors.textMuted;
  const opColor = leader.opPl > 0 ? colors.success : leader.opPl < 0 ? colors.error : colors.textMuted;
  return (
    <View style={styles.rivalryRow}>
      <View style={styles.rivalryIconWrap}>
        <Ionicons name="swap-horizontal" size={iconSize.xs} color={colors.gold} />
      </View>
      <View style={styles.rivalryContent}>
        <Text style={styles.rivalrySession}>{rivalry.sessionsTogether} sessions together</Text>
        <View style={styles.rivalryPlayers}>
          <Text style={[styles.rivalryPlayer, { color: plColor }]} numberOfLines={1}>
            {leader.name} {leader.pl > 0 ? '+' : ''}{formatPL(leader.pl)}
          </Text>
          <Text style={styles.rivalryVs}>vs</Text>
          <Text style={[styles.rivalryPlayer, { color: opColor }]} numberOfLines={1}>
            {leader.opName} {leader.opPl > 0 ? '+' : ''}{formatPL(leader.opPl)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (!role) return null; // no empty pill when role is missing
  const tone = role.toLowerCase() === 'owner' ? 'gold' : 'neutral';
  return <Chip label={role} tone={tone} />;
}

const styles = StyleSheet.create({
  listWrap: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: spacing.lg, paddingBottom: 60 },
  headerSection: { marginBottom: spacing.xs },
  headerEditBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  groupCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    gap: spacing.sm,
    overflow: 'hidden',
    ...shadows.md,
  },
  groupCardGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  groupName: { ...typography.displaySerif, fontSize: 27, color: colors.text },
  groupDesc: { ...typography.body, color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.xs },
  metaText: { ...typography.bodySmall, color: colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textDim },

  groupStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.sm,
    paddingVertical: 9,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupStatChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.lg },
  groupStatText: { ...typography.labelSmall, color: colors.textMuted },
  groupStatDivider: { width: 1, height: 14, backgroundColor: colors.border },

  navRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.sm,
  },
  navButtonInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconWrapGold: { backgroundColor: colors.goldFaint },
  navButtonText: { ...typography.label, color: colors.text },
  navButtonGold: { backgroundColor: colors.goldFaint, borderColor: colors.goldMuted },
  navButtonGoldText: { ...typography.label, color: colors.gold },

  manageSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: 14,
    ...shadows.sm,
  },
  shareInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.goldMuted,
    backgroundColor: colors.goldFaint,
    minHeight: 48,
  },
  shareInviteText: { ...typography.labelSmall, color: colors.gold },

  inviteSection: { gap: spacing.sm },
  inviteLabel: { ...typography.caps, color: colors.textMuted },
  inviteRow: { flexDirection: 'row', gap: 10 },
  inviteInput: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...typography.body,
    color: colors.text,
  },
  inviteButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.sm,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  inviteButtonDisabled: { opacity: 0.4 },
  inviteButtonText: { ...typography.labelSmall, color: colors.background },

  searchDropdown: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  searchDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchDropdownName: { flex: 1, ...typography.label, color: colors.text },
  searchDropdownInvite: { ...typography.caption, fontWeight: '700', color: colors.gold },

  sectionTitle: {
    ...typography.caps,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { ...typography.label, color: colors.text },
  memberEmail: { ...typography.caption, color: colors.textMuted },
  removeButton: { marginLeft: spacing.xs },
  removeIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.errorFaint,
    borderWidth: 1,
    borderColor: colors.errorMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  separator: { height: spacing.sm },

  leaveButton: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.errorMuted,
    borderRadius: radii.md,
    paddingVertical: 14,
  },
  leaveButtonText: { ...typography.label, color: colors.error },

  deleteGroupButton: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.errorMuted,
    borderRadius: radii.md,
    paddingVertical: 14,
    backgroundColor: colors.errorFaint,
  },
  deleteGroupButtonText: { ...typography.label, color: colors.error },

  leaderboardSection: { marginBottom: spacing.lg },
  lbHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  lbPeriod: { marginBottom: spacing.md },
  lbEmpty: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
  lbEmptyText: { ...typography.bodySmall, color: colors.textMuted },
  lbEmptyCta: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
  },
  lbEmptyCtaText: { ...typography.labelSmall, color: colors.gold },
  leaderboardCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    gap: 10,
  },
  leaderboardRowFirst: { backgroundColor: colors.goldFaint, borderLeftWidth: 3, borderLeftColor: colors.gold, paddingLeft: 11 },
  leaderboardRowSecond: { backgroundColor: RANK_SILVER + '14', borderLeftWidth: 3, borderLeftColor: RANK_SILVER, paddingLeft: 11 },
  leaderboardRowThird: { backgroundColor: RANK_BRONZE + '14', borderLeftWidth: 3, borderLeftColor: RANK_BRONZE, paddingLeft: 11 },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbRank: { ...typography.caption, fontWeight: '800' },
  lbInfo: { flex: 1, gap: 3 },
  lbUsername: { ...typography.label, color: colors.text },
  lbSessions: { ...typography.caption, color: colors.textMuted },
  lbRight: { alignItems: 'flex-end', gap: 3 },
  lbPL: { ...typography.label, fontWeight: '800', fontVariant: ['tabular-nums'] },
  lbAvg: { ...typography.caption, fontVariant: ['tabular-nums'] },

  emptyMembers: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 28,
    alignItems: 'center',
  },
  emptyMembersText: { ...typography.body, color: colors.textMuted },

  activitySection: { marginBottom: spacing.lg },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  seeAllLink: { ...typography.labelSmall, color: colors.gold },
  activityCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  activityDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  activityIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityDesc: { flex: 1, ...typography.bodySmall, color: colors.text },
  activityTime: { ...typography.caption, color: colors.textMuted, flexShrink: 0 },
  activityLoadMoreRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  activityLoadMoreText: { ...typography.labelSmall, color: colors.gold },
  rivalryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  rivalryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  rivalryContent: { flex: 1, gap: 3 },
  rivalrySession: { ...typography.caption, color: colors.textMuted },
  rivalryPlayers: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rivalryPlayer: { ...typography.labelSmall, flex: 1 },
  rivalryVs: { ...typography.caption, color: colors.textDim },
});
