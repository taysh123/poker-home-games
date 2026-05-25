import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useScreenEntrance } from '../hooks/useScreenEntrance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { pulse } from '../theme/motion';
import { getMyStats, RecentSessionDto } from '../api/statsApi';
import { deleteSession, updateSessionName } from '../api/sessionsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import SessionListItem from '../components/SessionListItem';
import { formatPL, formatDate, formatDuration } from '../utils/formatters';
import ActionSheet from '../components/ActionSheet';
import SkeletonCard from '../components/SkeletonCard';
import SkeletonRow from '../components/SkeletonRow';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AllSessionsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const entrance = useScreenEntrance();
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

  // Pulse for live dot
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    pulse(pulseAnim).start();
    return () => pulseAnim.stopAnimation();
  }, []);

  const stickyHeader = (
    <View style={[styles.stickyHeader, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.screenTitle}>Sessions</Text>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.textDim} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search sessions…"
          placeholderTextColor={colors.textDim}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textDim} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.flex}>
        {stickyHeader}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Active Now</Text>
            <SkeletonCard height={64} borderRadius={16} />
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Recent Sessions</Text>
            <View style={[styles.card, { overflow: 'hidden' }]}>
              <SkeletonRow isFirst />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.flex}>
        {stickyHeader}
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.textDim} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const actionSession = actionSheetSession;

  return (
    <View style={styles.flex}>
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
        <Animated.View style={entrance.style}>

        {/* ── Active ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Active Now</Text>
          {active.length === 0 ? (
            <TouchableOpacity
              style={styles.newGameCta}
              onPress={() => navigation.navigate('NewGame', {})}
              activeOpacity={0.88}
            >
              <View style={styles.newGameLeft}>
                <View style={styles.newGameIconWrap}>
                  <Ionicons name="play" size={16} color={colors.background} />
                </View>
                <View>
                  <Text style={styles.newGameCtaText}>Start New Game</Text>
                  <Text style={styles.newGameCtaSub}>Deal in your crew for tonight</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(15,25,35,0.5)" />
            </TouchableOpacity>
          ) : (
            <View style={[styles.card, styles.activeCard]}>
              {active.map((s, i) => (
                <TouchableOpacity
                  key={s.sessionId}
                  style={[styles.activeRow, i > 0 && styles.divider]}
                  onPress={() => openSession(s)}
                  activeOpacity={0.7}
                >
                  <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                  <View style={styles.rowLeft}>
                    <Text style={styles.sessionName}>{s.sessionName}</Text>
                    <Text style={styles.groupName}>{s.groupName ?? 'Solo game'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.gold} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Recent Sessions ── */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>
              Recent Sessions{finished.length < allFinished.length ? ` (${finished.length})` : ''}
            </Text>
            {selectedGroup && (
              <TouchableOpacity onPress={() => setSelectedGroup(null)}>
                <Text style={styles.clearFilter}>Clear filter</Text>
              </TouchableOpacity>
            )}
          </View>
          {groupNames.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChips}
            >
              {groupNames.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.filterChip, selectedGroup === g && styles.filterChipActive]}
                  onPress={() => setSelectedGroup(prev => prev === g ? null : g)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, selectedGroup === g && styles.filterChipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {finished.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name={q ? 'search-outline' : 'layers-outline'} size={28} color={colors.textDim} />
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
                  <View key={s.sessionId} style={styles.rowWrapper}>
                    <View style={{ flex: 1 }}>
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
                      <TouchableOpacity
                        style={styles.moreBtn}
                        onPress={() => setActionSheetSession(s)}
                        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
        </Animated.View>
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
      <Modal
        visible={renameState !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameState(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename Session</Text>
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
            />
            {renameError ? <Text style={styles.inlineError}>{renameError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setRenameState(null)}
                disabled={renaming}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, (!renameInput.trim() || renaming) && styles.modalSaveDisabled]}
                onPress={handleRename}
                disabled={!renameInput.trim() || renaming}
              >
                {renaming ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete confirmation modal ── */}
      <Modal
        visible={deleteConfirmSession !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteConfirmSession(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Session</Text>
            <Text style={styles.deleteBody}>
              Permanently remove "{deleteConfirmSession?.sessionName}"?{'\n'}
              All buy-ins, cash-outs, and history will be deleted. This cannot be undone.
            </Text>
            {deleteError ? <Text style={styles.inlineError}>{deleteError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setDeleteConfirmSession(null)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, deleting && styles.modalSaveDisabled]}
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 8 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 32,
  },

  stickyHeader: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: colors.background,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },

  section: { marginBottom: 28 },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  clearFilter: { fontSize: 12, color: colors.gold, fontWeight: '600' },
  filterChips: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: colors.goldFaint,
    borderColor: colors.goldMuted,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: colors.gold },
  sectionLabel: {
    ...typography.caps,
    color: colors.textMuted,
    paddingHorizontal: 2,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.sm,
  },
  activeCard: {
    borderColor: colors.goldMuted,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
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
  moreBtn:     { paddingHorizontal: 14, paddingVertical: 16 },

  divider: { borderTopWidth: 1, borderTopColor: colors.border },

  newGameCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    ...shadows.gold,
  },
  newGameLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  newGameIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(15,25,35,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newGameCtaText: { ...typography.label, color: colors.background },
  newGameCtaSub:  { ...typography.caption, color: 'rgba(15,25,35,0.6)', marginTop: 1 },

  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center' as const,
    gap: 8,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyText:    { ...typography.labelSmall, color: colors.textMuted },
  emptySubtext: { ...typography.caption, color: colors.textDim },
  errorText:  { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  retryBtn:   {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText:  { ...typography.labelSmall, color: colors.textMuted },

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
  modalInput: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  inlineError: { fontSize: 13, color: colors.error, textAlign: 'center' },
  modalActions:      { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelText:   { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  modalSave: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText:     { fontSize: 15, fontWeight: '700', color: colors.background },

  deleteBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  deleteBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
});
