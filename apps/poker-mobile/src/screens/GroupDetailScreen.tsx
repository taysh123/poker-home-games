import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Share,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { USE_NATIVE_DRIVER } from '../theme/motion';
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

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId, groupName, showInviteOnLoad } = route.params;
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
  const [lbPeriod, setLbPeriod] = useState<'week' | 'month' | 'all'>('all');
  const [lbLoading, setLbLoading] = useState(false);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdminOrOwner = group?.myRole === 'Admin' || group?.myRole === 'Owner';
  const isOwner = group?.myRole === 'Owner';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const [groupData, membersData, leaderboardData, activityData, rivalsData] = await Promise.all([
        getGroupById(token, groupId),
        getGroupMembers(token, groupId),
        getGroupLeaderboard(token, groupId).catch(() => [] as PlayerLeaderboardEntryDto[]),
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
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      setLoading(true);
      load().then(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.spring(slideAnim, { toValue: 0, friction: 10, tension: 100, useNativeDriver: USE_NATIVE_DRIVER }),
        ]).start();
      });
    }, [load]),
  );

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
          <TouchableOpacity
            style={styles.headerEditBtn}
            onPress={() =>
              navigation.navigate('EditGroup', {
                groupId,
                groupName: group?.name ?? groupName,
                description: group?.description,
              })
            }
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={20} color={colors.gold} />
          </TouchableOpacity>
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
    confirmDialog(
      'Leave Group',
      `Are you sure you want to leave ${group?.name ?? groupName}?`,
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
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Group not found.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const ownerId = group.ownerId;

  return (
    <Screen>
    {header}
    <Animated.View style={[styles.listWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={members}
      keyExtractor={(item) => item.userId}
      ListHeaderComponent={
        <View style={styles.headerSection}>
          {/* Group info */}
          <View style={styles.groupCard}>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description ? (
              <Text style={styles.groupDesc}>{group.description}</Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
              </Text>
              <View style={styles.dot} />
              <RoleBadge role={group.myRole} />
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
                  />
                  <TouchableOpacity
                    style={[
                      styles.inviteButton,
                      (!inviteUsername.trim() || inviteLoading) && styles.inviteButtonDisabled,
                    ]}
                    onPress={() => handleInvite()}
                    disabled={!inviteUsername.trim() || inviteLoading}
                  >
                    {inviteLoading ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <Text style={styles.inviteButtonText}>Send</Text>
                    )}
                  </TouchableOpacity>
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
                        <TouchableOpacity
                          key={r.userId}
                          style={styles.searchDropdownItem}
                          onPress={() => handleInvite(r.username)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.searchDropdownAvatar}>
                            <Text style={styles.searchDropdownAvatarText}>
                              {r.username[0]?.toUpperCase() ?? '?'}
                            </Text>
                          </View>
                          <Text style={styles.searchDropdownName}>{r.username}</Text>
                          <Text style={styles.searchDropdownInvite}>Invite →</Text>
                        </TouchableOpacity>
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
                  <React.Fragment key={`${r.player1Id}-${r.player2Id}`}>
                    {i > 0 && <View style={styles.activityDivider} />}
                    <RivalryRow rivalry={r} />
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}

          {/* Leaderboard */}
          <View style={styles.leaderboardSection}>
            <View style={styles.lbHeader}>
              <Text style={styles.sectionTitle}>Leaderboard</Text>
              {lbLoading && <ActivityIndicator size="small" color={colors.gold} />}
            </View>
            <View style={styles.lbPeriodRow}>
              {(['week', 'month', 'all'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.lbPeriodTab, lbPeriod === p && styles.lbPeriodTabActive]}
                  onPress={() => {
                    setLbPeriod(p);
                    loadLeaderboard(p);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.lbPeriodText, lbPeriod === p && styles.lbPeriodTextActive]}>
                    {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All Time'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {leaderboard.length > 0 ? (
              <View style={styles.leaderboardCard}>
                {leaderboard.map((entry, index) => (
                  <React.Fragment key={entry.userId}>
                    {index > 0 && <View style={styles.separator} />}
                    <TouchableOpacity
                      onPress={() => navigation.navigate('PlayerProfile', { userId: entry.userId, username: entry.username })}
                      activeOpacity={0.75}
                    >
                      <LeaderboardRow entry={entry} rank={index + 1} />
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <View style={styles.lbEmpty}>
                <Text style={styles.lbEmptyText}>
                  {lbPeriod === 'all' ? 'No sessions recorded yet' : 'No sessions in this period'}
                </Text>
                {lbPeriod === 'all' && (
                  <TouchableOpacity
                    style={styles.lbEmptyCta}
                    onPress={() => navigation.navigate('NewGame', { groupId, groupName })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.lbEmptyCtaText}>Start a Game →</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Members</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isMemberOwner = item.userId === ownerId;
        const isCurrentUser = item.userId === user?.userId;
        const canRemove = isAdminOrOwner && !isMemberOwner && !isCurrentUser;
        return (
          <MemberRow
            member={item}
            canRemove={canRemove}
            isRemoving={actionLoading === item.userId}
            onRemove={() => handleRemoveMember(item)}
            onPress={() => navigation.navigate('PlayerProfile', { userId: item.userId, username: item.username ?? '' })}
          />
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
                <TouchableOpacity onPress={() => navigation.navigate('SessionsList', { groupId, groupName, userRole: group?.myRole ?? 'Member' })} hitSlop={8}>
                  <Text style={styles.seeAllLink}>See all →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.activityCard}>
                {activity.map((item, i) => (
                  <React.Fragment key={item.id}>
                    {i > 0 && <View style={styles.activityDivider} />}
                    <ActivityRow
                      item={item}
                      onPress={item.relatedSessionId
                        ? () => navigation.navigate('Session', { sessionId: item.relatedSessionId!, groupId })
                        : undefined}
                    />
                  </React.Fragment>
                ))}
                {activityHasMore && (
                  <>
                    <View style={styles.activityDivider} />
                    <TouchableOpacity
                      style={styles.activityLoadMoreRow}
                      onPress={loadMoreActivity}
                      disabled={activityLoadingMore}
                      activeOpacity={0.7}
                    >
                      {activityLoadingMore ? (
                        <ActivityIndicator size="small" color={colors.gold} />
                      ) : (
                        <Text style={styles.activityLoadMoreText}>Load more</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
          {!isOwner && (
            <PressableScale style={styles.leaveButton} onPress={handleLeaveGroup} haptic="light">
              <Ionicons name="exit-outline" size={16} color={colors.error} />
              <Text style={styles.leaveButtonText}>Leave Group</Text>
            </PressableScale>
          )}
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
    <TouchableOpacity style={styles.memberRow} onPress={onPress} activeOpacity={0.7}>
      <Avatar name={member.username ?? '?'} size={40} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.username}</Text>
        <Text style={styles.memberEmail}>{member.email}</Text>
      </View>
      <RoleBadge role={member.role} />
      {canRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
          disabled={isRemoving}
          hitSlop={8}
        >
          {isRemoving ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <View style={styles.removeIconWrap}>
              <Ionicons name="person-remove-outline" size={15} color={colors.error} />
            </View>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const RANK_COLORS: Record<number, string> = {
  1: '#C9A84C',
  2: '#8DA9C4',
  3: '#B87333',
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
        <Ionicons name={iconName} size={15} color={iconColor} />
      </View>
      <Text style={styles.activityDesc} numberOfLines={2}>{item.description}</Text>
      <Text style={styles.activityTime}>{ago}</Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.activityRow}>{inner}</View>;
  }

  return (
    <TouchableOpacity style={styles.activityRow} onPress={onPress} activeOpacity={0.7}>
      {inner}
      <Ionicons name="chevron-forward" size={13} color={colors.textDim} />
    </TouchableOpacity>
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
        <Ionicons name="swap-horizontal" size={15} color={colors.gold} />
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
  const isOwner = role === 'Owner';
  const isAdmin = role === 'Admin';
  return (
    <View
      style={[
        styles.badge,
        isOwner ? styles.badgeOwner : isAdmin ? styles.badgeAdmin : styles.badgeMember,
      ]}
    >
      <Text
        style={[styles.badgeText, isOwner ? styles.badgeTextOwner : styles.badgeTextMuted]}
      >
        {role}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listWrap: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 60 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  headerSection: { marginBottom: 4 },
  headerEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  groupCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    gap: 8,
    ...shadows.md,
  },
  groupName: { ...typography.displaySerif, fontSize: 27, color: colors.text },
  groupDesc: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  metaText: { fontSize: 13, color: colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textDim },

  groupStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 10,
    paddingVertical: 9,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupStatChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16 },
  groupStatText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  groupStatDivider: { width: 1, height: 14, backgroundColor: colors.border },

  navRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
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
  navButtonText: { fontSize: 15, fontWeight: '600', color: colors.text },
  navButtonGold: { backgroundColor: colors.goldFaint, borderColor: colors.goldMuted },
  navButtonGoldText: { fontSize: 15, fontWeight: '700', color: colors.gold },

  manageSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 14,
    ...shadows.sm,
  },
  shareInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.goldMuted,
    backgroundColor: colors.goldFaint,
    minHeight: 48,
  },
  shareInviteText: { fontSize: 14, fontWeight: '700', color: colors.gold },

  inviteSection: { gap: 8 },
  inviteLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  inviteRow: { flexDirection: 'row', gap: 10 },
  inviteInput: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  inviteButton: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  inviteButtonDisabled: { opacity: 0.4 },
  inviteButtonText: { color: colors.background, fontSize: 14, fontWeight: '700' },

  searchDropdown: {
    marginTop: 6,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  searchDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchDropdownAvatar: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchDropdownAvatarText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  searchDropdownName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  searchDropdownInvite: { fontSize: 12, color: colors.gold, fontWeight: '700' },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    ...shadows.sm,
  },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.text },
  memberEmail: { fontSize: 12, color: colors.textMuted },
  removeButton: { marginLeft: 4 },
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

  separator: { height: 8 },

  leaveButton: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.errorMuted,
    borderRadius: 14,
    paddingVertical: 14,
  },
  leaveButtonText: { fontSize: 15, fontWeight: '600', color: colors.error },

  deleteGroupButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.errorMuted,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: colors.errorFaint,
  },
  deleteGroupButtonText: { fontSize: 15, fontWeight: '700', color: colors.error },

  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7 },
  badgeOwner: {
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: colors.goldMuted,
  },
  badgeAdmin: {
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeMember: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  badgeTextOwner: { color: colors.gold },
  badgeTextMuted: { color: colors.textMuted },

  errorText: { fontSize: 15, color: colors.error, textAlign: 'center' },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },

  leaderboardSection: { marginBottom: 16 },
  lbHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  lbPeriodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  lbPeriodTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  lbPeriodTabActive: {
    backgroundColor: colors.goldFaint,
    borderColor: colors.goldMuted,
  },
  lbPeriodText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  lbPeriodTextActive: { color: colors.gold },
  lbEmpty: { paddingVertical: 20, alignItems: 'center', gap: 8 },
  lbEmptyText: { fontSize: 13, color: colors.textMuted },
  lbEmptyCta: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
  },
  lbEmptyCtaText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  leaderboardCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    ...shadows.sm,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  leaderboardRowFirst: { backgroundColor: colors.goldFaint, borderLeftWidth: 3, borderLeftColor: colors.gold, paddingLeft: 11 },
  leaderboardRowSecond: { backgroundColor: 'rgba(141,169,196,0.08)', borderLeftWidth: 3, borderLeftColor: '#8DA9C4', paddingLeft: 11 },
  leaderboardRowThird: { backgroundColor: 'rgba(184,115,51,0.08)', borderLeftWidth: 3, borderLeftColor: '#B87333', paddingLeft: 11 },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbRank: { fontSize: 12, fontWeight: '800' },
  lbInfo: { flex: 1, gap: 3 },
  lbUsername: { fontSize: 14, fontWeight: '700', color: colors.text },
  lbSessions: { fontSize: 11, color: colors.textMuted },
  lbRight: { alignItems: 'flex-end', gap: 3 },
  lbPL: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  lbAvg: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },

  emptyMembers: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
  },
  emptyMembersText: { fontSize: 14, color: colors.textMuted },

  activitySection: { marginBottom: 16 },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  seeAllLink: { fontSize: 12, fontWeight: '600', color: colors.gold },
  rivalryEmpty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  rivalryEmptyTitle: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginTop: 4 },
  rivalryEmptySub: { fontSize: 12, color: colors.textDim, textAlign: 'center', lineHeight: 17 },
  activityCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
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
  activityDesc: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  activityTime: { fontSize: 11, color: colors.textMuted, flexShrink: 0 },
  activityLoadMoreRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activityLoadMoreText: { fontSize: 12, fontWeight: '600', color: colors.gold },
  rivalryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  rivalrySession: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  rivalryPlayers: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rivalryPlayer: { fontSize: 13, fontWeight: '600', flex: 1 },
  rivalryVs: { fontSize: 11, color: colors.textDim, fontWeight: '500' },
});
