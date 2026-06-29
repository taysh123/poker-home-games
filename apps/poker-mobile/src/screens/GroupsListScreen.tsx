import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Share,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
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
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import Chip from '../components/Chip';
import SkeletonCard from '../components/SkeletonCard';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import AppModal from '../components/Modal';
import PressableScale from '../components/motion/PressableScale';
import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GroupsListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
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
    <View style={[styles.customHeader, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.customHeaderTitle}>My Groups</Text>
      <View style={styles.customHeaderActions}>
        <PressableScale
          style={styles.headerBtn}
          onPress={() => navigation.navigate('Invitations')}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={invitationCount > 0 ? `Invitations, ${invitationCount} pending` : 'Invitations'}
        >
          <Ionicons name="mail-outline" size={iconSize.sm} color={invitationCount > 0 ? colors.gold : colors.textMuted} />
          {invitationCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {invitationCount > 9 ? '9+' : String(invitationCount)}
              </Text>
            </View>
          )}
        </PressableScale>
        <PressableScale
          style={[styles.headerBtn, styles.addBtn]}
          onPress={() => navigation.navigate('CreateGroup')}
          haptic="medium"
          accessibilityRole="button"
          accessibilityLabel="Create group"
        >
          <Ionicons name="add" size={22} color={colors.gold} />
        </PressableScale>
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen>
        {customHeader}
        <View style={styles.listContent}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.skeletonRow, { marginBottom: spacing.sm }]}>
              <SkeletonCard height={44} borderRadius={radii.md} style={{ width: 44, flexShrink: 0 }} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <SkeletonCard height={14} borderRadius={radii.sm} style={{ width: '60%' }} />
                <SkeletonCard height={10} borderRadius={radii.sm} style={{ width: '40%' }} />
              </View>
            </View>
          ))}
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        {customHeader}
        <ErrorState
          message="We couldn't load your groups. Check your connection and try again."
          onRetry={loadGroups}
        />
      </Screen>
    );
  }

  if (groups.length === 0) {
    return (
      <Screen>
        {customHeader}
        <EmptyState
          ionicon="people-outline"
          title="No groups yet"
          subtitle="Create a group and invite your friends to start tracking games together"
          action={{ label: 'Create Group', onPress: () => navigation.navigate('CreateGroup') }}
        />
      </Screen>
    );
  }

  const actionGroup = actionSheetGroup;

  return (
    <Screen>
      {customHeader}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const isOwner = item.role === 'Owner';
          const isAdmin = item.role === 'Admin';
          return (
            <MotiView {...slideUpSequence({ reduced, delay: staggerIn(index) })}>
              <View style={styles.cardRow}>
                <PressableScale
                  style={styles.card}
                  haptic="light"
                  onPress={() => navigation.navigate('GroupDetail', { groupId: item.id, groupName: item.name })}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.memberCount} member${item.memberCount !== 1 ? 's' : ''}`}
                >
                  <Avatar name={item.name} size={44} style={styles.avatar} />
                  <View style={styles.cardLeft}>
                    <View style={styles.nameRow}>
                      <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
                      {(isOwner || isAdmin) && (
                        <Chip label={isOwner ? 'Owner' : 'Admin'} tone={isOwner ? 'gold' : 'neutral'} />
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
                  <Ionicons name="chevron-forward" size={iconSize.xs} color={colors.textDim} />
                </PressableScale>
                <PressableScale
                  style={styles.moreBtn}
                  haptic="light"
                  onPress={() => setActionSheetGroup(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`More options for ${item.name}`}
                >
                  <Ionicons name="ellipsis-horizontal" size={iconSize.sm} color={colors.textMuted} />
                </PressableScale>
              </View>
            </MotiView>
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
      <AppModal
        visible={deleteConfirmGroup !== null}
        onClose={() => { if (!deleting) setDeleteConfirmGroup(null); }}
        title="Delete Group"
      >
        <Text style={styles.deleteBody}>
          Permanently delete "{deleteConfirmGroup?.name}"?{'\n'}
          All sessions, settlements, and history will be removed. This cannot be undone.
        </Text>
        {deleteError ? <Text style={styles.inlineError}>{deleteError}</Text> : null}
        <View style={styles.modalActions}>
          <PressableScale
            style={styles.modalCancel}
            onPress={() => setDeleteConfirmGroup(null)}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </PressableScale>
          <PressableScale
            style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
            onPress={executeDelete}
            disabled={deleting}
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel={`Delete ${deleteConfirmGroup?.name ?? 'group'}`}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.deleteBtnText}>Delete</Text>
            )}
          </PressableScale>
        </View>
      </AppModal>
    </Screen>
  );
}


const styles = StyleSheet.create({
  // ── Custom header ──────────────────────────────────────────────────────────
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  customHeaderTitle: {
    ...typography.displaySerif,
    color: colors.text,
  },
  customHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },

  // ── Skeleton ───────────────────────────────────────────────────────────────
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
  },

  // ── Card row ─────────────────────────────────────────────────────────────
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    ...shadows.sm,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingVertical: spacing.md,
    paddingRight: spacing.xs,
  },
  avatar: {
    borderRadius: radii.md,
    flexShrink: 0,
  },
  cardLeft: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  groupName: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1,
  },
  groupDesc: {
    ...typography.caption,
    color: colors.textMuted,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  memberCount: {
    ...typography.caption,
    color: colors.textDim,
    flex: 1,
  },
  plText: {
    ...typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  plPositive: { color: colors.success },
  plNegative: { color: colors.error },
  separator: {
    height: spacing.sm,
  },
  moreBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    minWidth: 44,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
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

  // ── Delete modal body (DS Modal provides overlay + card + title) ──
  inlineError: { ...typography.bodySmall, color: colors.error, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  modalCancel: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { ...typography.label, color: colors.textMuted },
  deleteBody: { ...typography.body, color: colors.textMuted },
  deleteBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.control,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { ...typography.label, color: colors.text },
});
