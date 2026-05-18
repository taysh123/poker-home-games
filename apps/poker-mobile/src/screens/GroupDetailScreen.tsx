import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme/colors';
import { getGroupById, getGroupMembers, GroupDetailResponse, GroupMemberDto } from '../api/groupsApi';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId, groupName } = route.params;

  const [group, setGroup] = useState<GroupDetailResponse | null>(null);
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: groupName,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    });
  }, [navigation, groupName]);

  useEffect(() => {
    load();
  }, [groupId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const [groupData, membersData] = await Promise.all([
        getGroupById(token, groupId),
        getGroupMembers(token, groupId),
      ]);
      setGroup(groupData);
      setMembers(membersData);
    } catch {
      setError('Failed to load group details.');
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={members}
      keyExtractor={(item) => item.userId}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.groupCard}>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description ? (
              <Text style={styles.groupDesc}>{group.description}</Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</Text>
              <View style={styles.dot} />
              <RoleBadge role={group.myRole} />
            </View>
          </View>
          <TouchableOpacity
            style={styles.sessionsButton}
            onPress={() =>
              navigation.navigate('SessionsList', {
                groupId,
                groupName,
                userRole: group.myRole,
              })
            }
          >
            <Text style={styles.sessionsButtonText}>Sessions</Text>
            <Text style={styles.sessionsChevron}>›</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Members</Text>
        </View>
      }
      renderItem={({ item }) => <MemberRow member={item} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

function MemberRow({ member }: { member: GroupMemberDto }) {
  const initial = member.username[0].toUpperCase();
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
    </View>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isOwner = role === 'Owner';
  const isAdmin = role === 'Admin';
  return (
    <View style={[styles.badge, isOwner ? styles.badgeOwner : isAdmin ? styles.badgeAdmin : styles.badgeMember]}>
      <Text style={[styles.badgeText, isOwner ? styles.badgeTextOwner : styles.badgeTextMuted]}>
        {role}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  header: {
    marginBottom: 4,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 8,
  },
  groupName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  groupDesc: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textDim,
  },
  sessionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sessionsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sessionsChevron: {
    fontSize: 22,
    color: colors.gold,
    lineHeight: 24,
  },
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
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gold,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  memberEmail: {
    fontSize: 12,
    color: colors.textMuted,
  },
  separator: {
    height: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
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
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeTextOwner: {
    color: colors.gold,
  },
  badgeTextMuted: {
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 15,
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
