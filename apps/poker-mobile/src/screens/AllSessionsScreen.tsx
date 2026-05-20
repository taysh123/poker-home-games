import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { getMyStats, RecentSessionDto } from '../api/statsApi';
import { deleteSession, updateSessionName } from '../api/sessionsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import { formatPL, formatDate, formatDuration } from '../utils/formatters';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AllSessionsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<RecentSessionDto[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [renameState, setRenameState] = useState<{ sessionId: string; name: string } | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);

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

  function promptActions(s: RecentSessionDto) {
    Alert.alert(
      s.sessionName,
      s.groupName || undefined,
      [
        { text: 'Open Session', onPress: () => openSession(s) },
        {
          text: 'Rename Session',
          onPress: () => {
            setRenameState({ sessionId: s.sessionId, name: s.sessionName });
            setRenameInput(s.sessionName);
          },
        },
        {
          text: 'Delete Session',
          style: 'destructive',
          onPress: () => confirmDelete(s),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  }

  function confirmDelete(s: RecentSessionDto) {
    Alert.alert(
      'Delete Session',
      `Permanently remove "${s.sessionName}"? All buy-ins, cash-outs, and history will be deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('accessToken');
              if (!token) return;
              await deleteSession(token, s.sessionId);
              setSessions(prev => prev.filter(x => x.sessionId !== s.sessionId));
            } catch {
              Alert.alert('Error', 'Failed to delete session. Please try again.');
            }
          },
        },
      ],
    );
  }

  async function handleRename() {
    if (!renameState) return;
    const trimmed = renameInput.trim();
    if (!trimmed || trimmed === renameState.name) { setRenameState(null); return; }
    setRenaming(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await updateSessionName(token, renameState.sessionId, trimmed);
      setSessions(prev =>
        prev.map(s => s.sessionId === renameState.sessionId ? { ...s, sessionName: trimmed } : s),
      );
      setRenameState(null);
    } catch {
      Alert.alert('Error', 'Failed to rename session. Please try again.');
    } finally {
      setRenaming(false);
    }
  }

  const active   = sessions.filter(s => s.status === 'Active');
  const finished = sessions.filter(s => s.status === 'Finished');

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
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      {/* ── Active ── */}
      <Text style={styles.sectionLabel}>Active Now</Text>
      {active.length === 0 ? (
        <TouchableOpacity
          style={styles.newGameCta}
          onPress={() => navigation.navigate('NewGame', {})}
          activeOpacity={0.85}
        >
          <Text style={styles.newGameCtaText}>♠  Start New Game</Text>
          <Text style={styles.newGameCtaChevron}>›</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.activeCard}>
          {active.map((s, i) => (
            <React.Fragment key={s.sessionId}>
              {i > 0 && <View style={styles.divider} />}
              <TouchableOpacity style={styles.activeRow} onPress={() => openSession(s)} activeOpacity={0.7}>
                <View style={styles.liveDot} />
                <View style={styles.rowLeft}>
                  <Text style={styles.sessionName}>{s.sessionName}</Text>
                  <Text style={styles.groupName}>{s.groupName}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* ── Recent ── */}
      <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Recent Sessions</Text>
      {finished.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardIcon}>🃏</Text>
          <Text style={styles.emptyText}>No sessions yet</Text>
          <Text style={styles.emptySubtext}>Finished games will appear here</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {finished.map((s, i) => {
            const pl = s.profitLoss;
            const plColor = pl != null && pl > 0 ? colors.success : pl != null && pl < 0 ? colors.error : colors.textMuted;
            const canManage = s.userRole === 'Admin' || s.userRole === 'Owner';
            return (
              <React.Fragment key={s.sessionId}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.rowWrapper}>
                  <TouchableOpacity style={styles.row} onPress={() => openSession(s)} activeOpacity={0.7}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.sessionName}>{s.sessionName}</Text>
                      <Text style={styles.groupName}>
                        {s.groupName}  ·  {formatDate(s.createdAt)}
                        {s.startedAt && s.endedAt ? `  ·  ${formatDuration(s.startedAt, s.endedAt)}` : ''}
                      </Text>
                    </View>
                    {pl != null ? (
                      <Text style={[styles.plValue, { color: plColor }]}>{formatPL(pl)}</Text>
                    ) : (
                      <Text style={styles.chevron}>›</Text>
                    )}
                  </TouchableOpacity>
                  {canManage && (
                    <TouchableOpacity
                      style={styles.moreBtn}
                      onPress={() => promptActions(s)}
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <Text style={styles.moreBtnText}>···</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </React.Fragment>
            );
          })}
        </View>
      )}
      {/* Rename modal */}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

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
    paddingVertical: 14,
    gap: 12,
  },
  liveDot: {
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

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: { flex: 1, gap: 3 },
  sessionName: { fontSize: 15, fontWeight: '700', color: colors.text },
  groupName:   { fontSize: 12, color: colors.textMuted },
  plValue:     { fontSize: 14, fontWeight: '700' },
  chevron:     { fontSize: 20, color: colors.textDim, fontWeight: '300' },
  moreBtn:     { paddingHorizontal: 6, paddingVertical: 4, marginLeft: 4 },
  moreBtnText: { fontSize: 16, color: colors.textMuted, letterSpacing: 1 },

  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  rowWrapper: { flexDirection: 'row', alignItems: 'center' },

  newGameCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  newGameCtaText: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.background },
  newGameCtaChevron: { fontSize: 24, color: 'rgba(15,25,35,0.6)', fontWeight: '300' },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center' as const,
  },
  emptyCardIcon: { fontSize: 28, marginBottom: 4 },
  emptyText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  emptySubtext: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center', marginHorizontal: 24 },
  retryBtn:  { borderWidth: 1, borderColor: colors.gold, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: colors.gold, fontWeight: '600' },

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
  modalSave: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: colors.background },
});
