import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import {
  getSessionById,
  startSession,
  endSession,
  addPlayer,
  removePlayer,
  addBuyIn,
  addCashOut,
  getSessionBalances,
  SessionDetailDto,
  SessionPlayerDto,
  SessionBalancesDto,
  PlayerBalanceDto,
} from '../api/sessionsApi';
import { searchUsers, UserSearchResultDto } from '../api/usersApi';
import { getSessionHandHistory, addHandRecord, deleteHandRecord, updateSessionNotes, HandRecordDto } from '../api/handsApi';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionDetail'>;

type TransactionModal = {
  visible: boolean;
  type: 'buyin' | 'cashout';
  player: { sessionPlayerId: string; username: string } | null;
};

export default function SessionDetailScreen({ route, navigation }: Props) {
  const { sessionId, sessionName } = route.params;
  const { user } = useAuth();

  const [session, setSession] = useState<SessionDetailDto | null>(null);
  const [balances, setBalances] = useState<SessionBalancesDto | null>(null);
  const [myRole, setMyRole] = useState<string>('Member');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [txModal, setTxModal] = useState<TransactionModal>({
    visible: false,
    type: 'buyin',
    player: null,
  });
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Notes state
  const [notesInput, setNotesInput] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Hand history state
  const [hands, setHands] = useState<HandRecordDto[]>([]);
  const [showHandModal, setShowHandModal] = useState(false);
  const [handWinner, setHandWinner] = useState('');
  const [handPot, setHandPot] = useState('');
  const [handNote, setHandNote] = useState('');
  const [handSubmitting, setHandSubmitting] = useState(false);
  const [deletingHandId, setDeletingHandId] = useState<string | null>(null);

  // Add Player modal state
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResultDto[]>([]);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [addingPlayerId, setAddingPlayerId] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: sessionName,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    });
  }, [navigation, sessionName]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');

      const sessionData = await getSessionById(token, sessionId);
      const [balancesData, handsData] = await Promise.all([
        getSessionBalances(token, sessionId),
        getSessionHandHistory(token, sessionId).catch(() => [] as HandRecordDto[]),
      ]);

      setSession(sessionData);
      setBalances(balancesData);
      setHands(handsData);
      setNotesInput(sessionData.notes ?? '');

      // Derive role from session players list (caller is a member if they can view)
      const me = sessionData.players.find((p) => p.userId === user?.userId);
      if (!me) setMyRole('Admin'); // non-player group members can still manage
    } catch {
      setError('Failed to load session.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Load group members for role check separately
  useEffect(() => {
    async function checkRole() {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (!token || !session) return;
        const { getGroupMembers } = await import('../api/groupsApi');
        const members = await getGroupMembers(token, session.groupId);
        const me = members.find((m) => m.userId === user?.userId);
        setMyRole(me?.role ?? 'Member');
      } catch {}
    }
    if (session) checkRole();
  }, [session?.groupId, user?.userId]);

  function handleUserSearchChange(text: string) {
    setUserSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (!token) return;
        const results = await searchUsers(token, text);
        setSearchResults(results);
      } catch {}
    }, 300);
  }

  async function handleStart() {
    setActionLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      await startSession(token, sessionId);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to start session.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEnd() {
    Alert.alert('End Session', 'Are you sure you want to end this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Session',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            const token = await SecureStore.getItemAsync('accessToken');
            if (!token) throw new Error('Not authenticated');
            await endSession(token, sessionId);
            navigation.navigate('SessionSummary', { sessionId, sessionName });
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to end session.');
            setActionLoading(false);
          }
        },
      },
    ]);
  }

  async function handleAddRegisteredPlayer(userId: string) {
    setAddingPlayerId(userId);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      await addPlayer(token, sessionId, userId);
      await load();
      setUserSearch('');
      setSearchResults([]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to add player.');
    } finally {
      setAddingPlayerId(null);
    }
  }

  async function handleAddGuest() {
    const name = guestNameInput.trim();
    if (!name) {
      Alert.alert('Invalid', 'Please enter a guest name.');
      return;
    }
    setAddingPlayerId('guest');
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      await addPlayer(token, sessionId, undefined, name);
      await load();
      setGuestNameInput('');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to add guest.');
    } finally {
      setAddingPlayerId(null);
    }
  }

  async function handleRemovePlayer(sessionPlayerId: string, username: string) {
    Alert.alert('Remove Player', `Remove ${username} from this session?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            const token = await SecureStore.getItemAsync('accessToken');
            if (!token) throw new Error('Not authenticated');
            await removePlayer(token, sessionId, sessionPlayerId);
            await load();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to remove player.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }

  function openTransaction(type: 'buyin' | 'cashout', player: { sessionPlayerId: string; username: string }) {
    setAmount('');
    setTxModal({ visible: true, type, player });
  }

  function openRebuy(player: { sessionPlayerId: string; username: string }) {
    setAmount(session?.defaultBuyIn ? String(session.defaultBuyIn) : '');
    setTxModal({ visible: true, type: 'buyin', player });
  }

  async function handleConfirmTransaction() {
    if (!txModal.player) return;
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');

      if (txModal.type === 'buyin') {
        await addBuyIn(token, sessionId, txModal.player.sessionPlayerId, parsed);
      } else {
        await addCashOut(token, sessionId, txModal.player.sessionPlayerId, parsed);
      }

      setTxModal({ visible: false, type: 'buyin', player: null });
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Transaction failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await updateSessionNotes(token, sessionId, notesInput.trim() || null);
      setEditingNotes(false);
    } catch {
      Alert.alert('Error', 'Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleLogHand() {
    const pot = parseFloat(handPot);
    if (!handWinner) { Alert.alert('Missing', 'Please select a winner.'); return; }
    if (isNaN(pot) || pot <= 0) { Alert.alert('Invalid', 'Enter a valid pot amount greater than 0.'); return; }
    setHandSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const newHand = await addHandRecord(token, sessionId, handWinner, pot, handNote.trim() || undefined);
      setHands(prev => [...prev, newHand]);
      setShowHandModal(false);
      setHandWinner('');
      setHandPot('');
      setHandNote('');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to log hand.');
    } finally {
      setHandSubmitting(false);
    }
  }

  async function handleDeleteHand(handId: string) {
    setDeletingHandId(handId);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await deleteHandRecord(token, sessionId, handId);
      setHands(prev => prev.filter(h => h.id !== handId));
    } catch (err: any) {
      const status = err?.response?.status;
      Alert.alert('Error', status === 403 ? 'You can only delete hands you logged.' : 'Failed to delete hand.');
    } finally {
      setDeletingHandId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Session not found.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isDraft = session.status === 'Draft';
  const isActive = session.status === 'Active';
  const isAdminOrOwner = myRole === 'Owner' || myRole === 'Admin';

  const addedUserIds = new Set(session.players.filter((p) => !p.isGuest).map((p) => p.userId));
  const addedGuestNames = new Set(session.players.filter((p) => p.isGuest).map((p) => p.username));

  const balanceMap = new Map<string, PlayerBalanceDto>(
    balances?.players.map((p) => [p.sessionPlayerId, p]) ?? [],
  );

  const totalBuyIns = balances?.totalPot ?? 0;
  const sessionDuration = session.startedAt
    ? formatDuration(new Date(session.startedAt), session.endedAt ? new Date(session.endedAt) : new Date())
    : null;

  const txTitle = txModal.type === 'buyin'
    ? `Buy In — ${txModal.player?.username}`
    : `Cash Out — ${txModal.player?.username}`;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoTop}>
            <Text style={styles.sessionName}>{session.name}</Text>
            <StatusBadge status={session.status} />
          </View>
          {(session.chipRatio != null || session.defaultBuyIn != null) && (
            <View style={styles.infoRow}>
              {session.chipRatio != null && (
                <InfoChip label="Chip Ratio" value={`1:${session.chipRatio}`} />
              )}
              {session.defaultBuyIn != null && (
                <InfoChip label="Default Buy-In" value={`₪${session.defaultBuyIn}`} />
              )}
            </View>
          )}
          {session.startedAt && (
            <Text style={styles.dateText}>
              Started {new Date(session.startedAt).toLocaleString()}
            </Text>
          )}
        </View>

        {/* Stats row */}
        {!isDraft && (
          <View style={styles.statsRow}>
            <StatChip label="Players" value={String(session.players.length)} />
            <StatChip label="Total Buy-Ins" value={`₪${totalBuyIns.toLocaleString()}`} />
            {sessionDuration && <StatChip label="Duration" value={sessionDuration} />}
          </View>
        )}

        {/* Players section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Players ({session.players.length})
          </Text>
          {(isDraft || isActive) && (
            <TouchableOpacity
              style={styles.addPlayerButton}
              onPress={() => setShowAddPlayer(true)}
              disabled={actionLoading}
            >
              <Text style={styles.addPlayerText}>+ Add Player</Text>
            </TouchableOpacity>
          )}
        </View>

        {session.players.length === 0 ? (
          <View style={styles.emptyPlayers}>
            <Text style={styles.emptyPlayersText}>No players added yet</Text>
          </View>
        ) : isDraft ? (
          <View style={styles.playerList}>
            {session.players.map((player, index) => (
              <React.Fragment key={player.sessionPlayerId}>
                <PlayerRow
                  player={player}
                  canRemove
                  onRemove={() => handleRemovePlayer(player.sessionPlayerId, player.username)}
                />
                {index < session.players.length - 1 && <View style={styles.separator} />}
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={styles.playerList}>
            {session.players.map((player, index) => (
              <React.Fragment key={player.sessionPlayerId}>
                <PlayerBalanceCard
                  player={player}
                  balance={balanceMap.get(player.sessionPlayerId) ?? null}
                  isActive={isActive}
                  canRemoveGuest={isActive && player.isGuest}
                  onBuyIn={() => openTransaction('buyin', { sessionPlayerId: player.sessionPlayerId, username: player.username })}
                  onRebuy={session.defaultBuyIn != null ? () => openRebuy({ sessionPlayerId: player.sessionPlayerId, username: player.username }) : undefined}
                  onCashOut={() => openTransaction('cashout', { sessionPlayerId: player.sessionPlayerId, username: player.username })}
                  onRemove={() => handleRemovePlayer(player.sessionPlayerId, player.username)}
                />
                {index < session.players.length - 1 && <View style={styles.separator} />}
              </React.Fragment>
            ))}
          </View>
        )}
        {/* Notes section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Session Notes</Text>
          {!editingNotes && (
            <TouchableOpacity onPress={() => setEditingNotes(true)}>
              <Text style={styles.addPlayerText}>{notesInput ? 'Edit' : '+ Add'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {editingNotes ? (
          <View style={styles.notesEditCard}>
            <TextInput
              style={styles.notesInput}
              value={notesInput}
              onChangeText={setNotesInput}
              placeholder="Add notes about this session..."
              placeholderTextColor={colors.textDim}
              multiline
              maxLength={500}
              autoFocus
            />
            <View style={styles.notesButtons}>
              <TouchableOpacity
                style={styles.notesCancelBtn}
                onPress={() => { setEditingNotes(false); setNotesInput(session.notes ?? ''); }}
                disabled={savingNotes}
              >
                <Text style={styles.notesCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.notesSaveBtn}
                onPress={handleSaveNotes}
                disabled={savingNotes}
              >
                {savingNotes
                  ? <ActivityIndicator size="small" color={colors.background} />
                  : <Text style={styles.notesSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : notesInput ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>{notesInput}</Text>
          </View>
        ) : (
          <View style={styles.notesEmpty}>
            <Text style={styles.notesEmptyText}>No notes yet</Text>
          </View>
        )}

        {/* Hand history section — only during active sessions */}
        {isActive && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 20 }]}>
              <Text style={styles.sectionTitle}>Hands {hands.length > 0 ? `(${hands.length})` : ''}</Text>
              <TouchableOpacity onPress={() => { setHandWinner(''); setHandPot(''); setHandNote(''); setShowHandModal(true); }}>
                <Text style={styles.addPlayerText}>+ Log Hand</Text>
              </TouchableOpacity>
            </View>
            {hands.length === 0 ? (
              <View style={styles.notesEmpty}>
                <Text style={styles.notesEmptyText}>No hands logged yet</Text>
              </View>
            ) : (
              <View style={styles.playerList}>
                {[...hands].reverse().map((hand, index) => {
                  const isOwn = hand.createdByUserId === user?.userId;
                  const isDeleting = deletingHandId === hand.id;
                  return (
                    <React.Fragment key={hand.id}>
                      {index > 0 && <View style={styles.separator} />}
                      <View style={styles.handRow}>
                        <View style={styles.handLeft}>
                          <Text style={styles.handPot}>₪{hand.potAmount.toLocaleString()}</Text>
                          <Text style={styles.handWinner}> → {hand.winnerName}</Text>
                        </View>
                        <View style={styles.handRight}>
                          {hand.note ? (
                            <Text style={styles.handNote} numberOfLines={1}>"{hand.note}"</Text>
                          ) : null}
                          {isOwn && (
                            <TouchableOpacity
                              onPress={() => handleDeleteHand(hand.id)}
                              disabled={isDeleting}
                              hitSlop={8}
                            >
                              {isDeleting
                                ? <ActivityIndicator size="small" color={colors.error} />
                                : <Text style={styles.handDeleteBtn}>✕</Text>}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Action bar */}
      {actionLoading ? (
        <View style={styles.actionBar}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : isDraft && isAdminOrOwner ? (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>Start Session</Text>
          </TouchableOpacity>
        </View>
      ) : isActive && isAdminOrOwner ? (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.endButton} onPress={handleEnd}>
            <Text style={styles.endButtonText}>End Session</Text>
          </TouchableOpacity>
        </View>
      ) : !isDraft && !isActive ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => navigation.navigate('SessionSummary', { sessionId, sessionName })}
          >
            <Text style={styles.startButtonText}>View Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryLink}
            onPress={() => navigation.navigate('Settlement', { sessionId, sessionName })}
          >
            <Text style={styles.secondaryLinkText}>Manage Settlements</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Add Player Modal */}
      <Modal
        visible={showAddPlayer}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddPlayer(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddPlayer(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalSheet}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add Player</Text>

              {/* Search registered users */}
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username..."
                placeholderTextColor={colors.textDim}
                value={userSearch}
                onChangeText={handleUserSearchChange}
                autoCapitalize="none"
              />

              {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  {searchResults.map((result, index) => {
                    const alreadyIn = addedUserIds.has(result.userId);
                    return (
                      <React.Fragment key={result.userId}>
                        <View style={styles.memberPickerRow}>
                          <View style={styles.memberAvatar}>
                            <Text style={styles.memberAvatarText}>
                              {(result.username?.[0] ?? '?').toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.memberPickerName}>{result.username}</Text>
                          {alreadyIn ? (
                            <Text style={styles.alreadyInText}>Added</Text>
                          ) : (
                            <TouchableOpacity
                              style={styles.addBtn}
                              onPress={() => handleAddRegisteredPlayer(result.userId)}
                              disabled={addingPlayerId === result.userId}
                            >
                              {addingPlayerId === result.userId ? (
                                <ActivityIndicator size="small" color={colors.gold} />
                              ) : (
                                <Text style={styles.addBtnText}>Add</Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                        {index < searchResults.length - 1 && <View style={styles.separator} />}
                      </React.Fragment>
                    );
                  })}
                </View>
              )}

              {userSearch.length > 0 && userSearch.length < 2 && (
                <Text style={styles.searchHint}>Type at least 2 characters to search</Text>
              )}

              {/* Divider */}
              <View style={styles.modalDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR ADD GUEST</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Guest input */}
              <View style={styles.guestRow}>
                <TextInput
                  style={styles.guestInput}
                  placeholder="Guest name..."
                  placeholderTextColor={colors.textDim}
                  value={guestNameInput}
                  onChangeText={setGuestNameInput}
                  maxLength={50}
                />
                <TouchableOpacity
                  style={[styles.addBtn, styles.addGuestBtn]}
                  onPress={handleAddGuest}
                  disabled={addingPlayerId === 'guest' || !guestNameInput.trim()}
                >
                  {addingPlayerId === 'guest' ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : (
                    <Text style={styles.addBtnText}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>

              {addedGuestNames.has(guestNameInput.trim()) && guestNameInput.trim() !== '' && (
                <Text style={styles.guestDuplicateText}>
                  A guest named "{guestNameInput.trim()}" is already in this session.
                </Text>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Log Hand Modal */}
      <Modal
        visible={showHandModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHandModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => !handSubmitting && setShowHandModal(false)}
          >
            <View style={styles.txSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Log Hand</Text>

              <Text style={styles.txAmountLabel}>POT AMOUNT (₪)</Text>
              <TextInput
                style={[styles.txInput, { marginBottom: 16 }]}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textDim}
                value={handPot}
                onChangeText={setHandPot}
                editable={!handSubmitting}
              />

              <Text style={styles.txAmountLabel}>WINNER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {session?.players.map(p => (
                    <TouchableOpacity
                      key={p.sessionPlayerId}
                      style={[styles.winnerChip, handWinner === p.username && styles.winnerChipSelected]}
                      onPress={() => setHandWinner(p.username)}
                    >
                      <Text style={[styles.winnerChipText, handWinner === p.username && styles.winnerChipTextSelected]}>
                        {p.username}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.txAmountLabel}>NOTE (OPTIONAL)</Text>
              <TextInput
                style={[styles.txInput, { fontSize: 15, fontWeight: '400', height: 60, marginBottom: 20 }]}
                placeholder="e.g. rivered a flush..."
                placeholderTextColor={colors.textDim}
                value={handNote}
                onChangeText={setHandNote}
                maxLength={300}
                multiline
                editable={!handSubmitting}
              />

              <View style={styles.txButtons}>
                <TouchableOpacity
                  style={styles.txCancelBtn}
                  onPress={() => setShowHandModal(false)}
                  disabled={handSubmitting}
                >
                  <Text style={styles.txCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.txConfirmBtn}
                  onPress={handleLogHand}
                  disabled={handSubmitting}
                >
                  {handSubmitting
                    ? <ActivityIndicator color={colors.background} size="small" />
                    : <Text style={styles.txConfirmText}>Save Hand</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Transaction Modal */}
      <Modal
        visible={txModal.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setTxModal({ visible: false, type: 'buyin', player: null })}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => !submitting && setTxModal({ visible: false, type: 'buyin', player: null })}
          >
            <View style={styles.txSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>{txTitle}</Text>

              <Text style={styles.txAmountLabel}>AMOUNT (₪)</Text>
              <TextInput
                style={styles.txInput}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textDim}
                value={amount}
                onChangeText={setAmount}
                editable={!submitting}
                autoFocus
              />

              <View style={styles.txButtons}>
                <TouchableOpacity
                  style={styles.txCancelBtn}
                  onPress={() => setTxModal({ visible: false, type: 'buyin', player: null })}
                  disabled={submitting}
                >
                  <Text style={styles.txCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.txConfirmBtn, txModal.type === 'cashout' && styles.txConfirmBtnCashout]}
                  onPress={handleConfirmTransaction}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator
                      color={txModal.type === 'cashout' ? colors.success : colors.background}
                      size="small"
                    />
                  ) : (
                    <Text
                      style={[
                        styles.txConfirmText,
                        txModal.type === 'cashout' && styles.txConfirmTextCashout,
                      ]}
                    >
                      {txModal.type === 'buyin' ? 'Buy In' : 'Cash Out'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function PlayerRow({
  player,
  canRemove,
  onRemove,
}: {
  player: SessionPlayerDto;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <View style={styles.playerRow}>
      <View style={styles.playerAvatar}>
        <Text style={styles.playerAvatarText}>{(player.username?.[0] ?? '?').toUpperCase()}</Text>
      </View>
      <View style={styles.playerNameCol}>
        <Text style={styles.playerName}>{player.username}</Text>
        {player.isGuest && <Text style={styles.guestLabel}>Guest</Text>}
      </View>
      {canRemove && (
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PlayerBalanceCard({
  player,
  balance,
  isActive,
  canRemoveGuest,
  onBuyIn,
  onRebuy,
  onCashOut,
  onRemove,
}: {
  player: SessionPlayerDto;
  balance: PlayerBalanceDto | null;
  isActive: boolean;
  canRemoveGuest: boolean;
  onBuyIn: () => void;
  onRebuy?: () => void;
  onCashOut: () => void;
  onRemove: () => void;
}) {
  const totalBuyIn = balance?.totalBuyIn ?? 0;
  const totalCashOut = balance?.totalCashOut ?? 0;
  const profitLoss = balance?.profitLoss ?? 0;

  return (
    <View style={styles.balanceCard}>
      <View style={styles.balanceCardTop}>
        <View style={styles.playerAvatar}>
          <Text style={styles.playerAvatarText}>{(player.username?.[0] ?? '?').toUpperCase()}</Text>
        </View>
        <View style={styles.balanceInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.playerName}>{player.username}</Text>
            {player.isGuest && <Text style={styles.guestLabel}>Guest</Text>}
          </View>
          <Text style={styles.balanceSubtext}>
            Invested ₪{totalBuyIn.toLocaleString()}
            {totalCashOut > 0 ? `  ·  Cashed ₪${totalCashOut.toLocaleString()}` : ''}
          </Text>
        </View>
        {totalBuyIn > 0 && <ProfitLossBadge amount={profitLoss} />}
      </View>
      {isActive && (
        <View style={styles.balanceActions}>
          <TouchableOpacity style={styles.buyInBtn} onPress={onBuyIn}>
            <Text style={styles.buyInBtnText}>+ Buy In</Text>
          </TouchableOpacity>
          {onRebuy && (
            <TouchableOpacity style={styles.rebuyBtn} onPress={onRebuy}>
              <Text style={styles.rebuyBtnText}>Rebuy</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cashOutBtn} onPress={onCashOut}>
            <Text style={styles.cashOutBtnText}>Cash Out</Text>
          </TouchableOpacity>
          {canRemoveGuest && (
            <TouchableOpacity style={styles.removeGuestBtn} onPress={onRemove}>
              <Text style={styles.removeGuestText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function ProfitLossBadge({ amount }: { amount: number }) {
  const isPositive = amount > 0;
  const isNegative = amount < 0;
  const color = isPositive ? colors.success : isNegative ? colors.error : colors.textMuted;
  const prefix = isPositive ? '+' : '';
  return (
    <View style={[styles.profitBadge, { borderColor: color }]}>
      <Text style={[styles.profitBadgeText, { color }]}>
        {prefix}₪{Math.abs(amount).toLocaleString()}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'Active';
  const isDraft = status === 'Draft';
  return (
    <View style={[styles.badge, isActive ? styles.badgeActive : isDraft ? styles.badgeDraft : styles.badgeFinished]}>
      <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextMuted]}>
        {status}
      </Text>
    </View>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16, paddingBottom: 100 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    gap: 12,
  },
  infoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sessionName: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text },
  infoRow: { flexDirection: 'row', gap: 12 },
  chip: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  chipLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  chipValue: { fontSize: 18, fontWeight: '700', color: colors.gold },
  dateText: { fontSize: 12, color: colors.textMuted },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 3,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.gold },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  addPlayerButton: { paddingHorizontal: 4 },
  addPlayerText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  playerList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerAvatarText: { fontSize: 14, fontWeight: '700', color: colors.gold },
  playerNameCol: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerName: { fontSize: 15, fontWeight: '600', color: colors.text },
  guestLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  removeText: { fontSize: 13, color: colors.error, fontWeight: '600' },
  separator: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  emptyPlayers: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  emptyPlayersText: { fontSize: 14, color: colors.textMuted },

  balanceCard: { padding: 14, gap: 10 },
  balanceCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balanceInfo: { flex: 1, gap: 3 },
  balanceSubtext: { fontSize: 12, color: colors.textMuted },
  profitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  profitBadgeText: { fontSize: 12, fontWeight: '700' },
  balanceActions: { flexDirection: 'row', gap: 6, paddingLeft: 48 },
  buyInBtn: {
    flex: 1,
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buyInBtnText: { fontSize: 12, fontWeight: '700', color: colors.gold },
  rebuyBtn: {
    flex: 1,
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  rebuyBtnText: { fontSize: 12, fontWeight: '700', color: colors.gold },
  cashOutBtn: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cashOutBtnText: { fontSize: 12, fontWeight: '700', color: colors.text },
  removeGuestBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGuestText: { fontSize: 12, color: colors.error, fontWeight: '700' },

  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startButton: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonText: { fontSize: 16, fontWeight: '700', color: colors.background },
  endButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  endButtonText: { fontSize: 16, fontWeight: '700', color: colors.error },
  secondaryLink: { paddingVertical: 8, alignItems: 'center' },
  secondaryLinkText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeActive: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  badgeDraft: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeFinished: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  badgeTextActive: { color: colors.gold },
  badgeTextMuted: { color: colors.textMuted },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  txSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 8,
  },
  searchResults: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  searchHint: { fontSize: 12, color: colors.textMuted, marginBottom: 8, paddingLeft: 4 },
  modalDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.8 },
  guestRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  guestInput: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  guestDuplicateText: { fontSize: 12, color: colors.error, marginTop: 6 },
  memberPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  memberPickerName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  alreadyInText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  addGuestBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.gold },

  txAmountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  txInput: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  txButtons: { flexDirection: 'row', gap: 10 },
  txCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  txCancelText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  txConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  txConfirmBtnCashout: {
    backgroundColor: 'rgba(39,174,96,0.12)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  txConfirmText: { fontSize: 15, fontWeight: '700', color: colors.background },
  txConfirmTextCashout: { color: colors.success },
  noPlayersText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', padding: 16 },

  // Notes
  notesCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  notesText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  notesEmpty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 4,
  },
  notesEmptyText: { fontSize: 13, color: colors.textMuted },
  notesEditCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
    gap: 10,
  },
  notesInput: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  notesButtons: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  notesCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesCancelText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  notesSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.gold,
    minWidth: 60,
    alignItems: 'center',
  },
  notesSaveText: { fontSize: 13, color: colors.background, fontWeight: '700' },

  // Hand history
  handRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  handLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  handPot: { fontSize: 14, fontWeight: '700', color: colors.gold },
  handWinner: { fontSize: 14, fontWeight: '600', color: colors.text },
  handRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  handNote: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', maxWidth: 140 },
  handDeleteBtn: { fontSize: 14, color: colors.error, fontWeight: '700' },

  // Winner chips
  winnerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  winnerChipSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,168,76,0.15)',
  },
  winnerChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  winnerChipTextSelected: { color: colors.gold },

  errorText: { fontSize: 15, color: colors.error, textAlign: 'center' },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
