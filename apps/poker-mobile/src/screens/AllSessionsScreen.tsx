import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TextInput,
  Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
import { pulse } from '../theme/motion';
import { getMyStats, RecentSessionDto } from '../api/statsApi';
import { deleteSession, updateSessionName } from '../api/sessionsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import SessionListItem from '../components/SessionListItem';
import SectionTitle from '../components/SectionTitle';
import Chip from '../components/Chip';
import { formatDate, formatDuration } from '../utils/formatters';
import ActionSheet from '../components/ActionSheet';
import SkeletonCard from '../components/SkeletonCard';
import SkeletonRow from '../components/SkeletonRow';
import Screen from '../components/Screen';
import AppModal from '../components/Modal';
import ErrorState from '../components/ErrorState';
import PressableScale from '../components/motion/PressableScale';
import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AllSessionsScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [sessions, setSessions] = useState<RecentSessionDto[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Action sheet state
  const [actionSheetSession, setActionSheetSession] = useState<RecentSessionDto | null>(null);

  // Rename modal state
  const [renameState, setRenameState] = useState<{ sessionId: string; name: string } | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');

  // Delete confirm modal state
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<RecentSessionDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  function promptDelete(s: RecentSessionDto) {
    setDeleteError('');
    setDeleteConfirmSession(s);
  }

  async function executeDelete() {
    if (!deleteConfirmSession) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await deleteSession(token, deleteConfirmSession.sessionId);
      setSessions(prev => prev.filter(x => x.sessionId !== deleteConfirmSession.sessionId));
      setDeleteConfirmSession(null);
    } catch {
      setDeleteError('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleRename() {
    if (!renameState) return;
    const trimmed = renameInput.trim();
    if (!trimmed || trimmed === renameState.name) { setRenameState(null); return; }
    setRenaming(true);
    setRenameError('');
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await updateSessionName(token, renameState.sessionId, trimmed);
      setSessions(prev =>
        prev.map(s => s.sessionId === renameState.sessionId ? { ...s, sessionName: trimmed } : s),
      );
      setRenameState(null);
    } catch {
      setRenameError('Failed to rename. Please try again.');
    } finally {
      setRenaming(false);
    }
  }

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const active   = sessions.filter(s => s.status === 'Active');
  const allFinished = sessions.filter(s => s.status === 'Finished');
  const groupNames = Array.from(new Set(allFinished.map(s => s.groupName ?? 'Solo'))).sort();
  const q = searchQuery.trim().toLowerCase();
  const finished = allFinished
    .filter(s => !selectedGroup || (s.groupName ?? 'Solo') === selectedGroup)
    .filter(s => !q || s.sessionName.toLowerCase().includes(q));

  // Pulse for live dot (steady when Reduce Motion is on)
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (reduced) { pulseAnim.setValue(1); return; }
    const loop = pulse(pulseAnim);
    loop.start();
    return () => loop.stop();
  }, [reduced]);

  const stickyHeader = (
    <View style={[styles.stickyHeader, { paddingTop: embedded ? spacing.xs : insets.top + spacing.md }]}>
      {!embedded && <Text style={styles.screenTitle}>Sessions</Text>}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={iconSize.xs} color={colors.textDim} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search sessions…"
          placeholderTextColor={colors.textDim}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          accessibilityLabel="Search sessions"
        />
        {searchQuery.length > 0 && (
          <PressableScale
            onPress={() => setSearchQuery('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={iconSize.xs} color={colors.textDim} />
          </PressableScale>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen>
        {stickyHeader}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <SectionTitle>ACTIVE NOW</SectionTitle>
            <SkeletonCard height={64} borderRadius={radii.lg} />
          </View>
          <View style={styles.section}>
            <SectionTitle>RECENT SESSIONS</SectionTitle>
            <View style={[styles.card, { overflow: 'hidden' }]}>
              <SkeletonRow isFirst />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        {stickyHeader}
        <ErrorState
          message="We couldn't load your sessions. Check your connection and try again."
          onRetry={() => load()}
        />
      </Screen>
    );
  }

  const actionSession = actionSheetSession;

  return (
    <Screen>
      {stickyHeader}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            progressBackgroundColor={colors.surface}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Active ── */}
        <MotiView {...slideUpSequence({ reduced })} style={styles.section}>
          <SectionTitle>ACTIVE NOW</SectionTitle>
          {active.length === 0 ? (
            <PressableScale
              style={styles.newGameCta}
              onPress={() => navigation.navigate('NewGame', {})}
              haptic="medium"
              accessibilityRole="button"
              accessibilityLabel="Start new game"
            >
              <View style={styles.newGameLeft}>
                <View style={styles.newGameIconWrap}>
                  <Ionicons name="play" size={iconSize.xs} color={colors.background} />
                </View>
                <View style={styles.newGameTextWrap}>
                  <Text style={styles.newGameCtaText}>Start New Game</Text>
                  <Text style={styles.newGameCtaSub}>Deal in your crew for tonight</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.background} />
            </PressableScale>
          ) : (
            <View style={[styles.card, styles.activeCard]}>
              {active.map((s, i) => (
                <PressableScale
                  key={s.sessionId}
                  style={[styles.activeRow, i > 0 && styles.divider]}
                  onPress={() => openSession(s)}
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityLabel={`${s.sessionName}, live, ${s.groupName ?? 'Solo game'}`}
                >
                  <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                  <View style={styles.rowLeft}>
                    <Text style={styles.sessionName} numberOfLines={1}>{s.sessionName}</Text>
                    <Text style={styles.groupName} numberOfLines={1}>{s.groupName ?? 'Solo game'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.gold} />
                </PressableScale>
              ))}
            </View>
          )}
        </MotiView>

        {/* ── Recent Sessions ── */}
        <View style={styles.section}>
          <SectionTitle
            action={
              selectedGroup ? (
                <PressableScale
                  onPress={() => setSelectedGroup(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear group filter"
                >
                  <Text style={styles.clearFilter}>Clear filter</Text>
                </PressableScale>
              ) : undefined
            }
          >
            {`RECENT SESSIONS${finished.length < allFinished.length ? ` (${finished.length})` : ''}`}
          </SectionTitle>

          {groupNames.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChips}
            >
              {groupNames.map(g => {
                const selected = selectedGroup === g;
                return (
                  <PressableScale
                    key={g}
                    style={styles.filterChipBtn}
                    onPress={() => setSelectedGroup(prev => prev === g ? null : g)}
                    haptic="light"
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Filter by ${g}${selected ? ', selected' : ''}`}
                  >
                    <Chip label={g} tone={selected ? 'gold' : 'neutral'} size="md" />
                  </PressableScale>
                );
              })}
            </ScrollView>
          )}

          {finished.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name={q ? 'search-outline' : 'layers-outline'} size={iconSize.md} color={colors.textDim} />
              </View>
              <Text style={styles.emptyText}>{q ? 'No results' : 'No sessions yet'}</Text>
              <Text style={styles.emptySubtext}>
                {q ? `No sessions match "${searchQuery}"` : 'Finished games will appear here'}
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {finished.map((s, i) => {
                const canManage = s.userRole === 'Admin' || s.userRole === 'Owner';
                return (
                  <MotiView key={s.sessionId} {...slideUpSequence({ reduced, delay: staggerIn(i) })} style={styles.rowWrapper}>
                    <View style={styles.rowFlex}>
                      <SessionListItem
                        name={s.sessionName}
                        meta={[
                          s.groupName ?? 'Solo',
                          formatDate(s.createdAt),
                          s.startedAt && s.endedAt ? formatDuration(s.startedAt, s.endedAt) : null,
                        ].filter(Boolean).join('  ·  ')}
                        profitLoss={s.profitLoss}
                        status={s.status}
                        onPress={() => openSession(s)}
                        isFirst={i === 0}
                      />
                    </View>
                    {canManage && (
                      <PressableScale
                        style={styles.moreBtn}
                        onPress={() => setActionSheetSession(s)}
                        haptic="light"
                        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Options for ${s.sessionName}`}
                      >
                        <Ionicons name="ellipsis-horizontal" size={iconSize.xs} color={colors.textMuted} />
                      </PressableScale>
                    )}
                  </MotiView>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Action sheet — outside ScrollView ── */}
      <ActionSheet
        visible={actionSheetSession !== null}
        onClose={() => setActionSheetSession(null)}
        title={actionSession?.sessionName}
        subtitle={actionSession?.groupName || undefined}
        options={[
          {
            label: 'Open Session',
            onPress: () => actionSession && openSession(actionSession),
          },
          {
            label: 'Rename Session',
            onPress: () => {
              if (!actionSession) return;
              setRenameState({ sessionId: actionSession.sessionId, name: actionSession.sessionName });
              setRenameInput(actionSession.sessionName);
            },
          },
          {
            label: 'Delete Session',
            style: 'destructive',
            onPress: () => actionSession && promptDelete(actionSession),
          },
          { label: 'Cancel', style: 'cancel', onPress: () => {} },
        ]}
      />

      {/* ── Rename modal ── */}
      <AppModal
        visible={renameState !== null}
        onClose={() => setRenameState(null)}
        title="Rename Session"
      >
        <TextInput
          style={styles.modalInput}
          value={renameInput}
          onChangeText={setRenameInput}
          placeholder="Session name"
          placeholderTextColor={colors.textDim}
          autoFocus
          maxLength={80}
          returnKeyType="done"
          onSubmitEditing={handleRename}
          accessibilityLabel="Session name"
        />
        {renameError ? <Text style={styles.inlineError}>{renameError}</Text> : null}
        <View style={styles.modalActions}>
          <PressableScale
            style={styles.modalCancel}
            onPress={() => setRenameState(null)}
            disabled={renaming}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </PressableScale>
          <PressableScale
            style={[styles.modalSave, (!renameInput.trim() || renaming) && styles.modalSaveDisabled]}
            onPress={handleRename}
            disabled={!renameInput.trim() || renaming}
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel="Save session name"
          >
            {renaming ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.modalSaveText}>Save</Text>
            )}
          </PressableScale>
        </View>
      </AppModal>

      {/* ── Delete confirmation modal ── */}
      <AppModal
        visible={deleteConfirmSession !== null}
        onClose={() => { if (!deleting) setDeleteConfirmSession(null); }}
        title="Delete Session"
      >
        <Text style={styles.deleteBody}>
          Permanently remove "{deleteConfirmSession?.sessionName}"?{'\n'}
          All buy-ins, cash-outs, and history will be deleted. This cannot be undone.
        </Text>
        {deleteError ? <Text style={styles.inlineError}>{deleteError}</Text> : null}
        <View style={styles.modalActions}>
          <PressableScale
            style={styles.modalCancel}
            onPress={() => setDeleteConfirmSession(null)}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </PressableScale>
          <PressableScale
            style={[styles.deleteBtn, deleting && styles.modalSaveDisabled]}
            onPress={executeDelete}
            disabled={deleting}
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel={`Delete ${deleteConfirmSession?.sessionName ?? 'session'}`}
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
  scroll: { flex: 1 },
  container: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge * 3, paddingTop: spacing.sm },

  stickyHeader: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  screenTitle: {
    ...typography.displaySerif,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
    gap: spacing.sm,
  },
  searchIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
  },

  section: { marginBottom: spacing.xxl + spacing.xs },
  clearFilter: { ...typography.caption, color: colors.gold, fontWeight: '700' },
  filterChips: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm, paddingTop: spacing.sm },
  filterChipBtn: { minHeight: 44, justifyContent: 'center' },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  activeCard: {
    borderColor: colors.goldMuted,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 3,
    gap: spacing.md,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },
  rowLeft: { flex: 1, gap: 3 },
  sessionName: { ...typography.label, color: colors.text },
  groupName:   { ...typography.caption, color: colors.textMuted },
  rowWrapper:  { flexDirection: 'row', alignItems: 'center' },
  rowFlex:     { flex: 1 },
  moreBtn:     { paddingHorizontal: spacing.md, paddingVertical: spacing.lg, minWidth: 44, alignItems: 'center', justifyContent: 'center' },

  divider: { borderTopWidth: 1, borderTopColor: colors.border },

  newGameCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadows.gold,
  },
  newGameLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  newGameIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.goldDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newGameTextWrap: { flex: 1 },
  newGameCtaText: { ...typography.label, color: colors.background },
  newGameCtaSub:  { ...typography.caption, color: colors.background, marginTop: 1 },

  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.xxxl,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyText:    { ...typography.labelSmall, color: colors.textMuted },
  emptySubtext: { ...typography.caption, color: colors.textDim },

  // ── Modal bodies (AppModal provides overlay + card + title) ──
  modalInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  inlineError: { ...typography.bodySmall, color: colors.error, textAlign: 'center' },
  modalActions:      { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  modalCancel: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText:   { ...typography.label, color: colors.textMuted },
  modalSave: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.control,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText:     { ...typography.label, color: colors.background },

  deleteBody: { ...typography.body, color: colors.textMuted },
  deleteBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.control,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { ...typography.label, color: colors.text },
});
