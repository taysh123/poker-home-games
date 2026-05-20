import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Share,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import {
  getMyGroups,
  getMyInvitations,
  MyGroupDto,
  generateGroupInviteLink,
  leaveGroup,
  deleteGroup,
} from '../api/groupsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import ActionSheet, { ActionSheetOption } from '../components/ActionSheet';
import { showToast } from '../utils/toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GroupsListScreen() {
  const navigation = useNavigation<Nav>();
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

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: 'My Groups',
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Invitations')}
            hitSlop={8}
            style={styles.bellButton}
          >
            <Text style={styles.bellIcon}>✉</Text>
            {invitationCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {invitationCount > 9 ? '9+' : String(invitationCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('CreateGroup')} hitSlop={8}>
            <Text style={styles.headerPlus}>+</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, invitationCount]);

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
        <TouchableOpacity style={styles.retryButton} onPress={loadGroups}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>♠</Text>
        <Text style={styles.emptyTitle}>No groups yet</Text>
        <Text style={styles.emptySubtitle}>Create a group and invite your friends</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateGroup')}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>+ Create Group</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const actionGroup = actionSheetGroup;

  return (
    <View style={styles.flex}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardRow}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('GroupDetail', { groupId: item.id, groupName: item.name })}
              activeOpacity={0.75}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.groupName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.groupDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                <Text style={styles.memberCount}>{item.memberCount} member{item.memberCount !== 1 ? 's' : ''}</Text>
              </View>
              <RoleBadge role={item.role} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => setActionSheetGroup(item)}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Text style={styles.moreBtnText}>···</Text>
            </TouchableOpacity>
          </View>
        )}
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
  flex: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
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
    borderRadius: 14,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardLeft: {
    flex: 1,
    gap: 4,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  groupDesc: {
    fontSize: 13,
    color: colors.textMuted,
  },
  memberCount: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: 2,
  },
  separator: {
    height: 10,
  },
  moreBtn: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  moreBtnText: {
    fontSize: 18,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeOwner: {
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  badgeAdmin: {
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bellButton: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    fontSize: 18,
    color: colors.textMuted,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '700',
  },
  headerPlus: {
    fontSize: 26,
    color: colors.gold,
    fontWeight: '300',
    lineHeight: 28,
    paddingHorizontal: 4,
  },
  emptyIcon: {
    fontSize: 48,
    color: colors.gold,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  createButton: {
    marginTop: 8,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.background,
  },
  errorText: {
    fontSize: 15,
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
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

  // ── Modals ─────────────────────────────────────────────────────────────
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
