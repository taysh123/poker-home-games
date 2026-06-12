import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StyleSheet,
  Modal,
  Share,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenEntrance } from '../hooks/useScreenEntrance';
import Screen from '../components/Screen';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import {
  getMyGroups,
  getMyInvitations,
  MyGroupDto,
  generateGroupInviteLink,
  leaveGroup,
  deleteGroup,
} from '../api/groupsApi';
import { formatPL } from '../utils/formatters';
import { RootStackParamList } from '../navigation/AppNavigator';
import ActionSheet, { ActionSheetOption } from '../components/ActionSheet';
import { showToast } from '../utils/toast';
import SkeletonCard from '../components/SkeletonCard';

const AVATAR_COLORS = [
  '#7C6EE8', '#4EAADC', '#50C878', '#E8965E', '#E86E8A',
  '#6EC6E8', '#A8E860', '#E8C45E', '#C46EE8', '#5EC8A0',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GroupsListScreen() {
  const navigation = useNavigation<Nav>();
  const entrance = useScreenEntrance();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<MyGroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitationCount, setInvitationCount] = useState(0);

  // Action sheet state
  const [actionSheetGroup, setActionSheetGroup] = useState<MyGroupDto | null>(null);

  // Delete confirm modal state
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<MyGroupDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const data = await getMyGroups(token);
      setGroups(data);
    } catch {
      setError('Failed to load groups. Tap to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvitationCount = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const data = await getMyInvitations(token);
      setInvitationCount(data.length);
    } catch {
      // silently ignore — badge is non-critical
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadGroups();
      void loadInvitationCount();
    }, [loadGroups, loadInvitationCount]),
  );


  async function handleShareInvite(group: MyGroupDto) {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const result = await generateGroupInviteLink(token, group.id);
      const url = result.deepLinkUrl;
      const message = `Join my poker group "${group.name}" on T Poker: ${url}`;
      try {
        await Share.share(Platform.OS === 'ios' ? { url, message } : { message });
      } catch {
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          showToast('Invite link copied to clipboard!', 'success');
        } else {
          showToast('Could not share link.', 'error');
        }
      }
    } catch {
      showToast('Failed to generate invite link. Try again.', 'error');
    }
  }

  async function handleLeave(group: MyGroupDto) {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await leaveGroup(token, group.id);
      setGroups(prev => prev.filter(g => g.id !== group.id));
      showToast(`Left "${group.name}"`, 'success');
    } catch {
      showToast('Failed to leave group. Please try again.', 'error');
    }
  }

  async function executeDelete() {
    if (!deleteConfirmGroup) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await deleteGroup(token, deleteConfirmGroup.id);
      setGroups(prev => prev.filter(g => g.id !== deleteConfirmGroup.id));
      setDeleteConfirmGroup(null);
      showToast(`"${deleteConfirmGroup.name}" deleted`, 'success');
    } catch {
      setDeleteError('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  function buildOptions(group: MyGroupDto): ActionSheetOption[] {
    const isOwner = group.role === 'Owner';
    const isAdmin = group.role === 'Admin';
    const canManage = isOwner || isAdmin;

    const opts: ActionSheetOption[] = [
      {
        label: 'Open Group',
        onPress: () => navigation.navigate('GroupDetail', { groupId: group.id, groupName: group.name }),
      },
    ];

    if (canManage) {
      opts.push({
        label: 'Share Invite Link',
        onPress: () => handleShareInvite(group),
      });
      opts.push({
        label: 'Edit Group',
        onPress: () => navigation.navigate('EditGroup', {
          groupId: group.id,
          groupName: group.name,
          description: group.description,
        }),
      });
    }

    if (!isOwner) {
      opts.push({
        label: 'Leave Group',
        style: 'destructive' as const,
        onPress: () => handleLeave(group),
      });
    }

    if (isOwner) {
      opts.push({
        label: 'Delete Group',
        style: 'destructive' as const,
        onPress: () => { setDeleteError(''); setDeleteConfirmGroup(group); },
      });
    }

    opts.push({ label: 'Cancel', style: 'cancel' as const, onPress: () => {} });
    return opts;
  }

  const customHeader = (
    <View style={[styles.customHeader, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.customHeaderTitle}>My Groups</Text>
      <View style={styles.customHeaderActions}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('Invitations')}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Ionicons name="mail-outline" size={20} color={invitationCount > 0 ? colors.gold : colors.textMuted} />
          {invitationCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {invitationCount > 9 ? '9+' : String(invitationCount)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerBtn, styles.addBtn]}
          onPress={() => navigation.navigate('CreateGroup')}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={colors.gold} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen>
        {customHeader}
        <Animated.View style={[{ flex: 1 }, entrance.style]}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.cardRow,
                { marginHorizontal: 16, marginTop: i === 0 ? 16 : 0, marginBottom: 10 },
              ]}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <SkeletonCard height={44} borderRadius={13} style={{ width: 44, flexShrink: 0 }} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonCard height={14} borderRadius={4} style={{ width: '60%' }} />
                  <SkeletonCard height={10} borderRadius={4} style={{ width: '40%' }} />
                </View>
              </View>
            </View>
          ))}
        </Animated.View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        {customHeader}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadGroups}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  if (groups.length === 0) {
    return (
      <Screen>
        {customHeader}
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="people-outline" size={36} color={colors.textDim} />
          </View>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySubtitle}>Create a group and invite your friends to start tracking games together</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CreateGroup')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color={colors.background} />
            <Text style={styles.createButtonText}>Create Group</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const actionGroup = actionSheetGroup;

  return (
    <Screen>
      {customHeader}
      <Animated.View style={[{ flex: 1 }, entrance.style]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const bg = avatarColor(item.name);
          const initial = item.name[0]?.toUpperCase() ?? '?';
          const isOwner = item.role === 'Owner';
          const isAdmin = item.role === 'Admin';
          return (
            <View style={styles.cardRow}>
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('GroupDetail', { groupId: item.id, groupName: item.name })}
                activeOpacity={0.75}
              >
                <View style={[styles.avatar, { backgroundColor: bg + '22' }]}>
                  <Text style={[styles.avatarText, { color: bg }]}>{initial}</Text>
                </View>
                <View style={styles.cardLeft}>
                  <View style={styles.nameRow}>
                    <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
                    {(isOwner || isAdmin) && (
                      <View style={[styles.badge, isOwner && styles.badgeOwner]}>
                        <Text style={[styles.badgeText, isOwner && styles.badgeTextOwner]}>
                          {isOwner ? 'Owner' : 'Admin'}
                        </Text>
                      </View>
                    )}
                  </View>
                  {item.description ? (
                    <Text style={styles.groupDesc} numberOfLines={1}>{item.description}</Text>
                  ) : null}
                  <View style={styles.memberRow}>
                    <Text style={styles.memberCount}>
                      {item.memberCount} member{item.memberCount !== 1 ? 's' : ''}
                      {item.myGroupSessions > 0 ? ` · ${item.myGroupSessions} sessions` : ''}
                    </Text>
                    {item.myGroupPL != null && (
                      <Text style={[styles.plText, item.myGroupPL >= 0 ? styles.plPositive : styles.plNegative]}>
                        {formatPL(item.myGroupPL)}
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => setActionSheetGroup(item)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* ── Action sheet ── */}
      <ActionSheet
        visible={actionSheetGroup !== null}
        onClose={() => setActionSheetGroup(null)}
        title={actionGroup?.name}
        subtitle={actionGroup ? `${actionGroup.memberCount} member${actionGroup.memberCount !== 1 ? 's' : ''}` : undefined}
        options={actionGroup ? buildOptions(actionGroup) : [{ label: 'Cancel', style: 'cancel', onPress: () => {} }]}
      />

      {/* ── Delete confirmation modal ── */}
      <Modal
        visible={deleteConfirmGroup !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteConfirmGroup(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Group</Text>
            <Text style={styles.deleteBody}>
              Permanently delete "{deleteConfirmGroup?.name}"?{'\n'}
              All sessions, settlements, and history will be removed. This cannot be undone.
            </Text>
            {deleteError ? <Text style={styles.inlineError}>{deleteError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setDeleteConfirmGroup(null)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
                onPress={executeDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={styles.deleteBtnText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </Animated.View>
    </Screen>
  );
}


const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },

  // ── Custom header ──────────────────────────────────────────────────────────
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  customHeaderTitle: {
    ...typography.displaySerif,
    color: colors.text,
  },
  customHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // ── Card row ─────────────────────────────────────────────────────────────
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    ...shadows.sm,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingVertical: 14,
    paddingRight: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardLeft: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupName: {
    ...typography.label,
    color: colors.text,
    flex: 1,
  },
  groupDesc: {
    ...typography.caption,
    color: colors.textMuted,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  memberCount: {
    ...typography.caption,
    color: colors.textDim,
    flex: 1,
  },
  plText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  plPositive: { color: colors.success },
  plNegative: { color: colors.error },
  separator: {
    height: 10,
  },
  moreBtn: {
    paddingHorizontal: 14,
    paddingVertical: 20,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeOwner: {
    backgroundColor: colors.goldFaint,
    borderColor: colors.goldMuted,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  badgeTextOwner: {
    color: colors.gold,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  addBtn: {
    borderColor: colors.goldMuted,
    backgroundColor: colors.goldFaint,
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.gold,
    borderRadius: 6,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  notifBadgeText: {
    color: colors.background,
    fontSize: 8,
    fontWeight: '800',
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.text,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  createButton: {
    marginTop: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  createButtonText: {
    ...typography.labelSmall,
    color: colors.background,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: {
    ...typography.labelSmall,
    color: colors.textMuted,
  },

  // ── Modals ──────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.bgOverlay,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  inlineError: { fontSize: 13, color: colors.error, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  deleteBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  deleteBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
});
