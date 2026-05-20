import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import {
  getGroupById,
  getGroupMembers,
  getGroupLeaderboard,
  GroupDetailResponse,
  GroupMemberDto,
  PlayerLeaderboardEntryDto,
  sendGroupInvitation,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
} from '../api/groupsApi';
import { getGroupActivity, ActivityLogDto } from '../api/activityApi';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId, groupName } = route.params;
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupDetailResponse | null>(null);
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [leaderboard, setLeaderboard] = useState<PlayerLeaderboardEntryDto[]>([]);
  const [activity, setActivity] = useState<ActivityLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAdminOrOwner = group?.myRole === 'Admin' || group?.myRole === 'Owner';
  const isOwner = group?.myRole === 'Owner';

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const [groupData, membersData, leaderboardData, activityData] = await Promise.all([
        getGroupById(token, groupId),
        getGroupMembers(token, groupId),
        getGroupLeaderboard(token, groupId).catch(() => [] as PlayerLeaderboardEntryDto[]),
        getGroupActivity(token, groupId).catch(() => [] as ActivityLogDto[]),
      ]);
      setGroup(groupData);
      setMembers(membersData);
      setLeaderboard(leaderboardData);
      setActivity(activityData);
    } catch {
      setError('Failed to load group details.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: groupName,
      headerRight: isAdminOrOwner
        ? () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('EditGroup', {
                  groupId,
                  groupName: group?.name ?? groupName,
                  description: group?.description,
                })
              }
              hitSlop={8}
            >
              <Text style={styles.editBtn}>Edit</Text>
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [navigation, groupId, groupName, group, isAdminOrOwner]);

  const handleInvite = async () => {
    const username = inviteUsername.trim();
    if (!username) return;
    try {
      setInviteLoading(true);
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await sendGroupInvitation(token, groupId, username);
      setInviteUsername('');
      Alert.alert('Invitation Sent', `${username} has been invited.`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.title ??
        'Failed to send invitation.';
      Alert.alert('Error', msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = (member: GroupMemberDto) => {
    Alert.alert('Remove Member', `Remove ${member.username} from the group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setActionLoading(member.userId);
            const token = await SecureStore.getItemAsync('accessToken');
            if (!token) return;
            await removeGroupMember(token, groupId, member.userId);
            await load();
          } catch {
            Alert.alert('Error', 'Failed to remove member.');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave ${group?.name ?? groupName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('accessToken');
              if (!token) return;
              await leaveGroup(token, groupId);
              navigation.navigate('GroupsList');
            } catch {
              Alert.alert('Error', 'Failed to leave group.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      `Permanently delete "${group?.name ?? groupName}"? This cannot be undone. All sessions, members, and history will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('accessToken');
              if (!token) return;
              await deleteGroup(token, groupId);
              navigation.navigate('GroupsList');
            } catch {
              Alert.alert('Error', 'Failed to delete group.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (error || !group) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Group not found.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ownerId = group.ownerId;

  return (
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

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <View style={styles.leaderboardSection}>
              <Text style={styles.sectionTitle}>Leaderboard</Text>
              <View style={styles.leaderboardCard}>
                {leaderboard.map((entry, index) => (
                  <React.Fragment key={entry.userId}>
                    {index > 0 && <View style={styles.separator} />}
                    <LeaderboardRow entry={entry} rank={index + 1} />
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}

          {/* Nav buttons */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navButton, { flex: 1 }]}
              onPress={() =>
                navigation.navigate('SessionsList', {
                  groupId,
                  groupName,
                  userRole: group.myRole,
                })
              }
            >
              <Text style={styles.navButtonText}>Sessions</Text>
              <Text style={styles.navChevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Invite — Admin/Owner only */}
          {isAdminOrOwner && (
            <View style={styles.inviteSection}>
              <Text style={styles.sectionTitle}>Invite Member</Text>
              <View style={styles.inviteRow}>
                <TextInput
                  style={styles.inviteInput}
                  value={inviteUsername}
                  onChangeText={setInviteUsername}
                  placeholder="Username"
                  placeholderTextColor={colors.textDim}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleInvite}
                  editable={!inviteLoading}
                />
                <TouchableOpacity
                  style={[
                    styles.inviteButton,
                    (!inviteUsername.trim() || inviteLoading) && styles.inviteButtonDisabled,
                  ]}
                  onPress={handleInvite}
                  disabled={!inviteUsername.trim() || inviteLoading}
                >
                  {inviteLoading ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text style={styles.inviteButtonText}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

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
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <View style={styles.activityCard}>
                {activity.slice(0, 15).map((item, i) => (
                  <React.Fragment key={item.id}>
                    {i > 0 && <View style={styles.activityDivider} />}
                    <ActivityRow item={item} />
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}
          {!isOwner && (
            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
              <Text style={styles.leaveButtonText}>Leave Group</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity style={styles.deleteGroupButton} onPress={handleDeleteGroup}>
              <Text style={styles.deleteGroupButtonText}>Delete Group</Text>
            </TouchableOpacity>
          )}
        </View>
      }
    />
  );
}

type MemberRowProps = {
  member: GroupMemberDto;
  canRemove: boolean;
  isRemoving: boolean;
  onRemove: () => void;
};

function MemberRow({ member, canRemove, isRemoving, onRemove }: MemberRowProps) {
  const initial = (member.username?.[0] ?? '?').toUpperCase();
  return (
    <View style={styles.memberRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
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
            <Text style={styles.removeText}>Remove</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function LeaderboardRow({ entry, rank }: { entry: PlayerLeaderboardEntryDto; rank: number }) {
  const isPositive = entry.totalProfitLoss > 0;
  const isNegative = entry.totalProfitLoss < 0;
  const plColor = isPositive ? colors.success : isNegative ? colors.error : colors.textMuted;
  const plPrefix = isPositive ? '+' : '';
  return (
    <View style={styles.leaderboardRow}>
      <Text style={[styles.lbRank, rank === 1 && styles.lbRankFirst]}>{rank}</Text>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(entry.username?.[0] ?? '?').toUpperCase()}</Text>
      </View>
      <View style={styles.lbInfo}>
        <Text style={styles.lbUsername}>{entry.username}</Text>
        <Text style={styles.lbSessions}>{entry.sessionsPlayed} session{entry.sessionsPlayed !== 1 ? 's' : ''}</Text>
      </View>
      <Text style={[styles.lbPL, { color: plColor }]}>
        {plPrefix}₪{Math.abs(entry.totalProfitLoss).toLocaleString()}
      </Text>
    </View>
  );
}

function activityIcon(type: string): string {
  switch (type) {
    case 'SessionCreated': return '🃏';
    case 'SessionStarted': return '▶';
    case 'SessionEnded':   return '■';
    case 'PlayerJoined':   return '→';
    case 'DebtCreated':    return '₪';
    case 'DebtSettled':    return '✓';
    case 'MemberJoined':   return '+';
    default: return '·';
  }
}

function ActivityRow({ item }: { item: ActivityLogDto }) {
  const ago = (() => {
    const diff = Date.now() - new Date(item.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  return (
    <View style={styles.activityRow}>
      <Text style={styles.activityIcon}>{activityIcon(item.type)}</Text>
      <Text style={styles.activityDesc} numberOfLines={2}>{item.description}</Text>
      <Text style={styles.activityTime}>{ago}</Text>
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
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  headerSection: { marginBottom: 4 },
  editBtn: { fontSize: 16, color: colors.gold, fontWeight: '600', paddingHorizontal: 4 },

  groupCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    gap: 8,
  },
  groupName: { fontSize: 20, fontWeight: '700', color: colors.text },
  groupDesc: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  metaText: { fontSize: 13, color: colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textDim },

  navRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  navButtonText: { fontSize: 15, fontWeight: '600', color: colors.text },
  navChevron: { fontSize: 22, color: colors.gold, lineHeight: 24 },

  inviteSection: { marginBottom: 16 },
  inviteRow: { flexDirection: 'row', gap: 10 },
  inviteInput: {
    flex: 1,
    backgroundColor: colors.surface,
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
  },
  inviteButtonDisabled: { opacity: 0.4 },
  inviteButtonText: { color: colors.background, fontSize: 14, fontWeight: '700' },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.gold },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.text },
  memberEmail: { fontSize: 12, color: colors.textMuted },
  removeButton: { marginLeft: 4, paddingHorizontal: 8, paddingVertical: 4 },
  removeText: { fontSize: 12, color: colors.error, fontWeight: '600' },

  separator: { height: 8 },

  leaveButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  leaveButtonText: { fontSize: 15, fontWeight: '600', color: colors.error },

  deleteGroupButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(231,76,60,0.08)',
  },
  deleteGroupButtonText: { fontSize: 15, fontWeight: '700', color: colors.error },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeOwner: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  badgeAdmin: {
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
  },
  badgeMember: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  badgeTextOwner: { color: colors.gold },
  badgeTextMuted: { color: colors.textMuted },

  errorText: { fontSize: 15, color: colors.error, textAlign: 'center' },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  leaderboardSection: { marginBottom: 16 },
  leaderboardCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  lbRank: {
    width: 22,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  lbRankFirst: { color: colors.gold },
  lbInfo: { flex: 1, gap: 2 },
  lbUsername: { fontSize: 14, fontWeight: '600', color: colors.text },
  lbSessions: { fontSize: 11, color: colors.textMuted },
  lbPL: { fontSize: 15, fontWeight: '700' },

  emptyMembers: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyMembersText: { fontSize: 14, color: colors.textMuted },

  activitySection: { marginHorizontal: 16, marginBottom: 16 },
  activityCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  activityDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  activityIcon: { fontSize: 14, color: colors.gold, width: 18, textAlign: 'center', marginTop: 1 },
  activityDesc: { flex: 1, fontSize: 13, color: colors.text },
  activityTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
