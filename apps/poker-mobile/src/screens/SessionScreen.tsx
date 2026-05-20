import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  getSessionById,
  getSessionBalances,
  addBuyIn,
  addCashOut,
  addPlayer,
  removePlayer,
  endSession,
  deleteSession,
  SessionDetailDto,
  SessionPlayerDto,
  PlayerBalanceDto,
  FinalStackItem,
} from '../api/sessionsApi';
import { getGroupMembers, GroupMemberDto } from '../api/groupsApi';
import {
  getSessionSettlements,
  calculateSettlements,
  markSettlementPaid,
  SettlementDto,
  GuestBalanceDto,
} from '../api/settlementsApi';
import {
  getSessionHandHistory,
  addHandRecord,
  deleteHandRecord,
  updateSessionNotes,
  HandRecordDto,
} from '../api/handsApi';
import { exportSessionCsv, shareSessionCard } from '../utils/exportUtils';
import { successNotification, errorNotification, lightTap } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

function toMoney(input: number, chipRatio: number | undefined, useChips: boolean): number {
  if (!useChips || !chipRatio || chipRatio === 0) return input;
  return input / chipRatio;
}

function formatMoney(value: number): string {
  return `₪${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDuration(start: string, end?: string | null, _tick?: number): string {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SessionScreen({ route, navigation }: Props) {
  const { sessionId, groupId } = route.params;
  const { user } = useAuth();

  const [session, setSession] = useState<SessionDetailDto | null>(null);
  const [balances, setBalances] = useState<PlayerBalanceDto[]>([]);
  const [hands, setHands] = useState<HandRecordDto[]>([]);
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [settlements, setSettlements] = useState<SettlementDto[]>([]);
  const [myRole, setMyRole] = useState<string>('Member');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chip/money toggle
  const [useChips, setUseChips] = useState(false);

  // Transaction modal (buy-in / cash-out)
  const [txModal, setTxModal] = useState<{
    visible: boolean;
    type: 'buyin' | 'cashout';
    player: SessionPlayerDto | null;
    needsPlayerSelect: boolean;
  }>({ visible: false, type: 'buyin', player: null, needsPlayerSelect: false });
  const [txAmount, setTxAmount] = useState('');
  const [txLoading, setTxLoading] = useState(false);

  // Add player modal
  const [addPlayerModal, setAddPlayerModal] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [guestName, setGuestName] = useState('');
  const [addingPlayerId, setAddingPlayerId] = useState<string | null>(null);
  const [addingGuest, setAddingGuest] = useState(false);

  // End session modal (final stacks)
  const [endModal, setEndModal] = useState(false);
  const [finalStacks, setFinalStacks] = useState<Record<string, string>>({});
  const [endLoading, setEndLoading] = useState(false);

  // Hand modal
  const [handModal, setHandModal] = useState(false);
  const [handPot, setHandPot] = useState('');
  const [handWinner, setHandWinner] = useState('');
  const [handNote, setHandNote] = useState('');
  const [handLoading, setHandLoading] = useState(false);

  // Notes
  const [notesText, setNotesText] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Settlements
  const [calcLoading, setCalcLoading] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [settlementsLoaded, setSettlementsLoaded] = useState(false);
  const [guestBalances, setGuestBalances] = useState<GuestBalanceDto[]>([]);

  // Export
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing]     = useState(false);

  // Delete session
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Timer ticker for active sessions
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = session?.status === 'Active';
  const isDraft = session?.status === 'Draft';
  const isFinished = session?.status === 'Finished';
  const isAdminOrOwner = myRole === 'Admin' || myRole === 'Owner';

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');

      const [sessionData, membersData] = await Promise.all([
        getSessionById(token, sessionId),
        getGroupMembers(token, groupId).catch(() => [] as GroupMemberDto[]),
      ]);

      setSession(sessionData);
      setMembers(membersData);
      setNotesText(sessionData.notes ?? '');

      const role = membersData.find(m => m.userId === user?.userId)?.role ?? 'Member';
      setMyRole(role);

      if (sessionData.status !== 'Draft') {
        const [balData, handsData] = await Promise.all([
          getSessionBalances(token, sessionId).catch(() => null),
          getSessionHandHistory(token, sessionId).catch(() => [] as HandRecordDto[]),
        ]);
        if (balData) setBalances(balData.players);
        setHands(handsData);

        if (sessionData.status === 'Finished') {
          const settData = await getSessionSettlements(token, sessionId).catch(() => null);
          if (settData) {
            setSettlements(settData.settlements);
            setSettlementsLoaded(true);
          }
          // Derive unlinked guest balances from already-loaded player + balance data
          if (balData) {
            const computed = sessionData.players
              .filter(p => p.isGuest && !p.linkedUserId)
              .map(p => {
                const bal = balData.players.find(b => b.sessionPlayerId === p.sessionPlayerId);
                return { sessionPlayerId: p.sessionPlayerId, guestName: p.username, netBalance: bal?.profitLoss ?? 0 };
              })
              .filter(g => g.netBalance !== 0);
            setGuestBalances(computed);
          }
        }
      }
    } catch {
      setError('Failed to load session.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId, groupId, user?.userId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  // Timer for active sessions
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => setTick(t => t + 1), 30000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive]);

  // Header
  useEffect(() => {
    if (!session) return;
    navigation.setOptions({
      headerShown: false,
    });
  }, [session, navigation]);

  // ── Transaction (buy-in / cash-out) ──

  function openTransaction(type: 'buyin' | 'cashout', player: SessionPlayerDto) {
    setTxAmount(session?.defaultBuyIn ? String(session.defaultBuyIn) : '');
    setTxModal({ visible: true, type, player, needsPlayerSelect: false });
  }

  function openActionBar(type: 'buyin' | 'cashout') {
    setTxAmount(session?.defaultBuyIn ? String(session.defaultBuyIn) : '');
    setTxModal({ visible: true, type, player: null, needsPlayerSelect: true });
  }

  async function handleTransaction() {
    if (!txModal.player || !session) return;
    const raw = parseFloat(txAmount);
    if (isNaN(raw) || raw <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount greater than 0.');
      return;
    }
    const money = toMoney(raw, session.chipRatio, useChips);
    setTxLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      if (txModal.type === 'buyin') {
        await addBuyIn(token, sessionId, txModal.player.sessionPlayerId, money);
      } else {
        await addCashOut(token, sessionId, txModal.player.sessionPlayerId, money);
      }
      successNotification();
      setTxModal({ visible: false, type: 'buyin', player: null, needsPlayerSelect: false });
      await load(true);
    } catch (e: any) {
      errorNotification();
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to record transaction.');
    } finally {
      setTxLoading(false);
    }
  }

  // ── Add Player ──

  async function handleAddMember(member: GroupMemberDto) {
    setAddingPlayerId(member.userId);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await addPlayer(token, sessionId, member.userId);
      lightTap();
      await load(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to add player.');
    } finally {
      setAddingPlayerId(null);
    }
  }

  async function handleAddGuest() {
    const name = guestName.trim();
    if (!name) return;
    setAddingGuest(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await addPlayer(token, sessionId, undefined, name);
      lightTap();
      setGuestName('');
      await load(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to add guest.');
    } finally {
      setAddingGuest(false);
    }
  }

  async function handleRemovePlayer(player: SessionPlayerDto) {
    Alert.alert('Remove Player', `Remove ${player.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync('accessToken');
            if (!token) return;
            await removePlayer(token, sessionId, player.sessionPlayerId);
            await load(true);
          } catch {
            Alert.alert('Error', 'Failed to remove player.');
          }
        },
      },
    ]);
  }

  // ── End Session ──

  function openEndModal() {
    const stacks: Record<string, string> = {};
    session?.players.forEach(p => { stacks[p.sessionPlayerId] = ''; });
    setFinalStacks(stacks);
    setEndModal(true);
  }

  async function handleEndSession() {
    setEndLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;

      const finalStackItems: FinalStackItem[] = Object.entries(finalStacks)
        .filter(([, v]) => v !== '' && !isNaN(parseFloat(v)) && parseFloat(v) >= 0)
        .map(([sessionPlayerId, v]) => ({
          sessionPlayerId,
          amount: toMoney(parseFloat(v), session?.chipRatio, useChips),
        }));

      await endSession(token, sessionId, finalStackItems);
      const calcResult = await calculateSettlements(token, sessionId).catch(() => ({ settlements: [], guestBalances: [] }));
      setSettlements(calcResult.settlements);
      setGuestBalances(calcResult.guestBalances);
      setSettlementsLoaded(true);
      successNotification();
      setEndModal(false);
      await load(true);
    } catch (e: any) {
      errorNotification();
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to end session.');
    } finally {
      setEndLoading(false);
    }
  }

  // ── Hand Logging ──

  async function handleAddHand() {
    const pot = parseFloat(handPot);
    if (!handWinner || isNaN(pot) || pot <= 0) {
      Alert.alert('Invalid hand', 'Enter pot amount and select a winner.');
      return;
    }
    setHandLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await addHandRecord(token, sessionId, handWinner, pot, handNote || undefined);
      lightTap();
      setHandModal(false);
      setHandPot(''); setHandWinner(''); setHandNote('');
      const token2 = await SecureStore.getItemAsync('accessToken');
      if (token2) setHands(await getSessionHandHistory(token2, sessionId).catch(() => hands));
    } catch {
      Alert.alert('Error', 'Failed to log hand.');
    } finally {
      setHandLoading(false);
    }
  }

  async function handleDeleteHand(handId: string) {
    Alert.alert('Delete Hand', 'Remove this hand record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync('accessToken');
            if (!token) return;
            await deleteHandRecord(token, sessionId, handId);
            setHands(h => h.filter(x => x.id !== handId));
          } catch {
            Alert.alert('Error', 'Failed to delete hand.');
          }
        },
      },
    ]);
  }

  // ── Notes ──

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await updateSessionNotes(token, sessionId, notesText || null);
      setEditingNotes(false);
    } catch {
      Alert.alert('Error', 'Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  }

  // ── Settlements ──

  async function handleCalculateSettlements() {
    setCalcLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const result = await calculateSettlements(token, sessionId);
      setSettlements(result.settlements);
      setGuestBalances(result.guestBalances);
      successNotification();
    } catch {
      Alert.alert('Error', 'Failed to calculate settlements.');
    } finally {
      setCalcLoading(false);
    }
  }

  async function handleMarkPaid(settlementId: string) {
    setMarkingPaidId(settlementId);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await markSettlementPaid(token, settlementId);
      setSettlements(s => s.map(x => x.id === settlementId ? { ...x, status: 'Confirmed' } : x));
      lightTap();
    } catch {
      Alert.alert('Error', 'Failed to mark as paid.');
    } finally {
      setMarkingPaidId(null);
    }
  }

  // ── Export ──

  async function handleExport() {
    if (!session) return;
    setExporting(true);
    try {
      await exportSessionCsv(sessionId, session.name);
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message ?? 'Could not export session.');
    } finally {
      setExporting(false);
    }
  }

  async function handleShareCard() {
    if (!session || !balances) return;
    setSharing(true);
    try {
      const date = new Date(session.endedAt ?? session.createdAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      const dur = session.startedAt && session.endedAt
        ? formatDuration(session.startedAt, session.endedAt)
        : '';
      await shareSessionCard(session.name, '', date, dur, balances, settlements);
    } catch (e: any) {
      Alert.alert('Share Failed', e?.message ?? 'Could not generate share card.');
    } finally {
      setSharing(false);
    }
  }

  // ── Delete Session ──

  function handleDeleteSession() {
    Alert.alert(
      'Delete Session',
      'This permanently removes all buy-ins, cash-outs, hand records, and settlements. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              const token = await SecureStore.getItemAsync('accessToken');
              if (!token) return;
              await deleteSession(token, sessionId);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Failed to delete session.');
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ],
    );
  }

  // ── Helpers ──

  const alreadyInSession = new Set(
    session?.players.map(p => p.userId).filter(Boolean) as string[]
  );

  const availableMembers = members.filter(m => !alreadyInSession.has(m.userId));
  const filteredMembers = playerSearch
    ? availableMembers.filter(m =>
        m.username.toLowerCase().includes(playerSearch.toLowerCase())
      )
    : availableMembers;

  function getBalance(player: SessionPlayerDto): PlayerBalanceDto | undefined {
    return balances.find(b => b.sessionPlayerId === player.sessionPlayerId);
  }

  const sortedPlayers = isFinished
    ? [...(session?.players ?? [])].sort((a, b) => {
        const ba = getBalance(a)?.profitLoss ?? 0;
        const bb = getBalance(b)?.profitLoss ?? 0;
        return bb - ba;
      })
    : session?.players ?? [];

  // ── Render ──

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
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalPot = balances.reduce((s, b) => s + b.totalBuyIn, 0);

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.gold} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{session.name}</Text>
            <View style={styles.headerMeta}>
              <StatusBadge status={session.status} />
              {isActive && session.startedAt && (
                <>
                  <View style={styles.liveDot} />
                  <Text style={styles.timer}>{formatDuration(session.startedAt, null, tick)}</Text>
                </>
              )}
              {session.chipRatio && (
                <TouchableOpacity
                  style={[styles.chipToggle, useChips && styles.chipToggleOn]}
                  onPress={() => setUseChips(v => !v)}
                >
                  <Text style={[styles.chipToggleText, useChips && styles.chipToggleTextOn]}>
                    {useChips ? '🪙 Chips' : '₪ Money'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {isFinished && (
            <TouchableOpacity onPress={handleExport} style={styles.exportBtn} disabled={exporting}>
              {exporting ? <ActivityIndicator color={colors.gold} size="small" /> : <Text style={styles.exportText}>CSV</Text>}
            </TouchableOpacity>
          )}
          {isFinished && balances.length > 0 && (
            <TouchableOpacity onPress={handleShareCard} style={styles.exportBtn} disabled={sharing}>
              {sharing ? <ActivityIndicator color={colors.gold} size="small" /> : <Text style={styles.exportText}>Share</Text>}
            </TouchableOpacity>
          )}
          {isAdminOrOwner && (
            <TouchableOpacity onPress={handleDeleteSession} style={styles.deleteBtn} disabled={deleteLoading} hitSlop={8}>
              {deleteLoading
                ? <ActivityIndicator color={colors.error} size="small" />
                : <Text style={styles.deleteBtnText}>🗑</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Session meta ── */}
        <View style={styles.metaRow}>
          {session.chipRatio && (
            <MetaChip label={`${session.chipRatio} chips/₪`} />
          )}
          {session.defaultBuyIn && (
            <MetaChip label={`Default buy-in: ${formatMoney(session.defaultBuyIn)}`} />
          )}
          {isFinished && session.endedAt && session.startedAt && (
            <MetaChip label={formatDuration(session.startedAt, session.endedAt)} />
          )}
          {(isActive || isFinished) && (
            <MetaChip label={`Pot: ${formatMoney(totalPot)}`} gold />
          )}
        </View>

        {/* ── Players ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isFinished ? 'Results' : 'Players'}
            </Text>
            {!isFinished && (
              <TouchableOpacity
                style={styles.addPlayerBtn}
                onPress={() => { setAddPlayerModal(true); setPlayerSearch(''); setGuestName(''); }}
              >
                <Text style={styles.addPlayerBtnText}>+ Add Player</Text>
              </TouchableOpacity>
            )}
          </View>

          {sortedPlayers.length === 0 ? (
            <View style={styles.emptyPlayers}>
              <Text style={styles.emptyPlayersText}>No players yet. Add players to start.</Text>
            </View>
          ) : (
            <View style={styles.playerList}>
              {sortedPlayers.map((player, index) => {
                const bal = getBalance(player);
                const pl = bal?.profitLoss ?? 0;
                const invested = bal?.totalBuyIn ?? 0;
                const cashed = bal?.totalCashOut ?? 0;
                const rank = isFinished ? index + 1 : 0;
                const isFirst = rank === 1 && isFinished;
                const plTint = bal
                  ? pl > 0 ? 'rgba(39,174,96,0.07)' : pl < 0 ? 'rgba(231,76,60,0.07)' : undefined
                  : undefined;

                return (
                  <View key={player.sessionPlayerId} style={[
                    styles.playerRow,
                    index > 0 && styles.playerRowBorder,
                    isFirst && styles.playerRowFirst,
                    plTint ? { backgroundColor: plTint } : undefined,
                    isFirst && { borderLeftWidth: 3, borderLeftColor: colors.gold },
                  ]}>
                    {/* Avatar + name */}
                    <View style={[styles.playerAvatar, isFirst && styles.playerAvatarFirst]}>
                      <Text style={styles.playerAvatarText}>
                        {player.username[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.playerInfo}>
                      <View style={styles.playerNameRow}>
                        <Text style={[styles.playerName, isFirst && styles.playerNameFirst]}>
                          {player.username}
                        </Text>
                        {player.isGuest && <GuestBadge />}
                        {isFinished && rank > 0 && (
                          <Text style={styles.rankLabel}>{rankLabel(rank)}</Text>
                        )}
                      </View>
                      {(isActive || isFinished) && bal && (
                        <Text style={styles.playerMeta}>
                          In: {formatMoney(invested)}
                          {cashed > 0 ? `  ·  Out: ${formatMoney(cashed)}` : ''}
                        </Text>
                      )}
                    </View>

                    {/* P&L / actions */}
                    {(isActive || isFinished) && bal ? (
                      <View style={styles.playerRight}>
                        {(isActive || isFinished) && (
                          <Text style={[
                            styles.plValue,
                            pl > 0 ? styles.plPos : pl < 0 ? styles.plNeg : styles.plZero,
                            isFirst && styles.plValueFirst,
                          ]}>
                            {pl > 0 ? '+' : ''}{formatMoney(pl)}
                          </Text>
                        )}
                        {isActive && (
                          <View style={styles.txButtons}>
                            <TouchableOpacity
                              style={styles.txBtn}
                              onPress={() => openTransaction('buyin', player)}
                            >
                              <Text style={styles.txBtnText}>Buy In</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.txBtn, styles.txBtnCash]}
                              onPress={() => openTransaction('cashout', player)}
                            >
                              <Text style={styles.txBtnText}>Cash Out</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ) : isDraft ? (
                      <TouchableOpacity
                        onPress={() => handleRemovePlayer(player)}
                        style={styles.removeBtn}
                        hitSlop={8}
                      >
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── End Session button (Active, Admin/Owner) ── */}
        {isActive && isAdminOrOwner && (
          <TouchableOpacity style={styles.endSessionBtn} onPress={openEndModal}>
            <Text style={styles.endSessionBtnText}>End Session</Text>
          </TouchableOpacity>
        )}

        {/* ── Settlements (Finished) ── */}
        {isFinished && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Settlements</Text>
              <TouchableOpacity onPress={handleCalculateSettlements} disabled={calcLoading}>
                {calcLoading
                  ? <ActivityIndicator color={colors.gold} size="small" />
                  : <Text style={styles.seeAll}>Recalculate</Text>}
              </TouchableOpacity>
            </View>

            {settlements.length === 0 ? (
              <View style={styles.evenCard}>
                <Text style={styles.evenIcon}>✓</Text>
                <Text style={styles.evenTitle}>Everyone is even</Text>
                <Text style={styles.evenSub}>No transfers needed — the math works out perfectly.</Text>
                <TouchableOpacity onPress={handleCalculateSettlements} disabled={calcLoading}>
                  {calcLoading
                    ? <ActivityIndicator color={colors.gold} size="small" />
                    : <Text style={styles.recalcLink}>Recalculate</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.settlementList}>
                {settlements.map(s => {
                  const isInvolved = s.payerUserId === user?.userId || s.receiverUserId === user?.userId;
                  const isPaid = s.status === 'Confirmed';
                  const payerInitial = s.payerName[0]?.toUpperCase() ?? '?';
                  const receiverInitial = s.receiverName[0]?.toUpperCase() ?? '?';
                  return (
                    <View key={s.id} style={[styles.settlementCard, isPaid && styles.settlementCardPaid]}>
                      {/* Left border accent */}
                      <View style={[styles.settlementAccent, isPaid && styles.settlementAccentPaid]} />
                      <View style={styles.settlementCardInner}>
                        {/* Players row */}
                        <View style={styles.settlementFlow}>
                          <View style={styles.settlementParty}>
                            <View style={styles.settlementAvatar}>
                              <Text style={styles.settlementAvatarText}>{payerInitial}</Text>
                            </View>
                            <Text style={styles.settlementPartyName} numberOfLines={1}>{s.payerName}</Text>
                          </View>
                          <View style={styles.settlementMiddle}>
                            <Text style={styles.settlementArrowIcon}>→</Text>
                            <Text style={styles.settlementAmount}>{formatMoney(s.amount)}</Text>
                          </View>
                          <View style={styles.settlementParty}>
                            <View style={[styles.settlementAvatar, styles.settlementAvatarReceiver]}>
                              <Text style={styles.settlementAvatarText}>{receiverInitial}</Text>
                            </View>
                            <Text style={styles.settlementPartyName} numberOfLines={1}>{s.receiverName}</Text>
                          </View>
                        </View>
                        {/* Action row */}
                        <View style={styles.settlementActionRow}>
                          {isPaid ? (
                            <View style={styles.badgePaidRow}>
                              <Text style={styles.settlementBadgeText}>PAID</Text>
                            </View>
                          ) : isInvolved ? (
                            <TouchableOpacity
                              style={styles.markPaidBtn}
                              onPress={() => handleMarkPaid(s.id)}
                              disabled={markingPaidId === s.id}
                            >
                              {markingPaidId === s.id
                                ? <ActivityIndicator color={colors.background} size="small" />
                                : <Text style={styles.markPaidText}>Mark Paid</Text>}
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.badgePendingRow}>
                              <Text style={styles.settlementBadgeText}>PENDING</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Guest Manual Settlements ── */}
        {isFinished && guestBalances.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Handle Manually</Text>
              <View style={styles.guestManualBadge}>
                <Text style={styles.guestManualBadgeText}>GUEST PLAYERS</Text>
              </View>
            </View>
            <View style={styles.guestManualCard}>
              <Text style={styles.guestManualSubtitle}>
                These guest players are not in the app — settle with them directly in cash.
              </Text>
              {guestBalances.map(g => {
                const owes = g.netBalance < 0;
                const amount = formatMoney(Math.abs(g.netBalance));
                return (
                  <View key={g.sessionPlayerId} style={styles.guestManualRow}>
                    <View style={[styles.guestManualAvatar, owes ? styles.guestManualAvatarOwes : styles.guestManualAvatarOwed]}>
                      <Text style={styles.settlementAvatarText}>{g.guestName[0]?.toUpperCase() ?? '?'}</Text>
                    </View>
                    <View style={styles.guestManualInfo}>
                      <Text style={styles.guestManualName}>{g.guestName}</Text>
                      <Text style={[styles.guestManualAction, owes ? styles.guestManualOwes : styles.guestManualOwed]}>
                        {owes ? `Owes ${amount} — collect cash` : `Is owed ${amount} — pay in cash`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Notes ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {!isFinished && !editingNotes && (
              <TouchableOpacity onPress={() => setEditingNotes(true)}>
                <Text style={styles.seeAll}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {editingNotes ? (
            <View style={styles.notesEdit}>
              <TextInput
                style={styles.notesInput}
                value={notesText}
                onChangeText={setNotesText}
                multiline
                maxLength={500}
                placeholder="Session notes..."
                placeholderTextColor={colors.textDim}
                autoFocus
              />
              <View style={styles.notesActions}>
                <TouchableOpacity onPress={() => { setNotesText(session.notes ?? ''); setEditingNotes(false); }}>
                  <Text style={styles.notesCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.notesSaveBtn} onPress={handleSaveNotes} disabled={savingNotes}>
                  {savingNotes
                    ? <ActivityIndicator color={colors.background} size="small" />
                    : <Text style={styles.notesSaveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : notesText ? (
            <Text style={styles.notesText}>{notesText}</Text>
          ) : (
            <Text style={styles.emptySubtitle}>No notes</Text>
          )}
        </View>

        {/* ── Hand History ── */}
        {(isActive || isFinished) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Hand History ({hands.length})</Text>
            </View>
            {hands.length === 0 ? (
              <Text style={styles.emptySubtitle}>No hands logged</Text>
            ) : (
              <View style={styles.handList}>
                {[...hands].reverse().map((h, i) => (
                  <View key={h.id} style={[styles.handRow, i > 0 && styles.handRowBorder]}>
                    <View style={styles.handInfo}>
                      <Text style={styles.handWinner}>{h.winnerName}</Text>
                      <Text style={styles.handPot}>{formatMoney(h.potAmount)} pot</Text>
                      {h.note && <Text style={styles.handNote}>{h.note}</Text>}
                    </View>
                    {h.createdByUserId === user?.userId && isActive && (
                      <TouchableOpacity onPress={() => handleDeleteHand(h.id)} hitSlop={8}>
                        <Text style={styles.handDelete}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: isActive ? 160 : 100 }} />
      </ScrollView>

      {/* ── Floating Log Hand button (Active) ── */}
      {isActive && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => { setHandPot(''); setHandWinner(''); setHandNote(''); setHandModal(true); }}
        >
          <Text style={styles.fabText}>+ Hand</Text>
        </TouchableOpacity>
      )}

      {/* ── Bottom Action Bar (Active sessions only) ── */}
      {isActive && (
        <View style={styles.actionBar}>
          {(['buyin', 'buyin', 'cashout'] as const).map((type, idx) => {
            const label = idx === 0 ? 'Buy In' : idx === 1 ? 'Rebuy' : 'Cash Out';
            const isLast = idx === 2;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.actionBarBtn, isLast && styles.actionBarBtnCash]}
                onPress={() => openActionBar(type)}
                activeOpacity={0.8}
              >
                <Text style={[styles.actionBarBtnText, isLast && styles.actionBarBtnTextCash]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Transaction Modal ── */}
      <Modal visible={txModal.visible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetTitleRow}>
              <View>
                <Text style={styles.sheetTitle}>
                  {txModal.type === 'buyin' ? 'Buy In' : 'Cash Out'}
                </Text>
                {txModal.player && <Text style={styles.sheetSubtitle}>{txModal.player.username}</Text>}
              </View>
              <TouchableOpacity onPress={() => setTxModal({ visible: false, type: 'buyin', player: null, needsPlayerSelect: false })} hitSlop={8}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Player selector phase (opened from bottom bar) */}
            {txModal.needsPlayerSelect && (
              <>
                <Text style={styles.subLabel}>Select Player</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerSelectScroll}>
                  {(session?.players ?? []).map(p => (
                    <TouchableOpacity
                      key={p.sessionPlayerId}
                      style={[styles.winnerChip, txModal.player?.sessionPlayerId === p.sessionPlayerId && styles.winnerChipSelected]}
                      onPress={() => setTxModal(prev => ({ ...prev, player: p, needsPlayerSelect: false }))}
                    >
                      <Text style={[styles.winnerChipText, txModal.player?.sessionPlayerId === p.sessionPlayerId && styles.winnerChipTextSelected]}>
                        {p.username}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Amount input (shown after player is selected or when opened from player row) */}
            {!txModal.needsPlayerSelect && (
              <>
                {session.chipRatio && (
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, !useChips && styles.toggleBtnActive]}
                      onPress={() => setUseChips(false)}
                    >
                      <Text style={[styles.toggleBtnText, !useChips && styles.toggleBtnTextActive]}>₪ Money</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, useChips && styles.toggleBtnActive]}
                      onPress={() => setUseChips(true)}
                    >
                      <Text style={[styles.toggleBtnText, useChips && styles.toggleBtnTextActive]}>🪙 Chips</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TextInput
                  style={styles.txInput}
                  value={txAmount}
                  onChangeText={setTxAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  autoFocus
                />

                {/* Preset amount chips */}
                {(() => {
                  const base = session?.defaultBuyIn ?? 100;
                  const presets = [base, base * 2, base * 3];
                  return (
                    <View style={styles.presetRow}>
                      {presets.map(p => (
                        <TouchableOpacity
                          key={p}
                          style={[styles.presetChip, txAmount === String(p) && styles.presetChipActive]}
                          onPress={() => setTxAmount(String(p))}
                        >
                          <Text style={[styles.presetChipText, txAmount === String(p) && styles.presetChipTextActive]}>
                            ₪{p.toLocaleString()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })()}

                {useChips && session.chipRatio && txAmount !== '' && !isNaN(parseFloat(txAmount)) ? (
                  <Text style={styles.txConvert}>
                    = {formatMoney(toMoney(parseFloat(txAmount), session.chipRatio, true))}
                  </Text>
                ) : (
                  <Text style={styles.txUnit}>{useChips ? 'chips' : '₪'}</Text>
                )}

                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setTxModal({ visible: false, type: 'buyin', player: null, needsPlayerSelect: false })}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, txModal.type === 'cashout' && styles.confirmBtnCash]}
                    onPress={handleTransaction}
                    disabled={txLoading}
                  >
                    {txLoading ? (
                      <ActivityIndicator color={colors.background} size="small" />
                    ) : (
                      <Text style={styles.confirmBtnText}>
                        {txModal.type === 'buyin' ? 'Confirm Buy-In' : 'Confirm Cash-Out'}
                        {txAmount && !isNaN(parseFloat(txAmount)) && parseFloat(txAmount) > 0
                          ? `  ${formatMoney(toMoney(parseFloat(txAmount), session.chipRatio, useChips))}`
                          : ''}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Player Modal ── */}
      <Modal visible={addPlayerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, styles.sheetTall]}>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Add Player</Text>
              <TouchableOpacity onPress={() => setAddPlayerModal(false)} hitSlop={8}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {filteredMembers.length > 0 && (
              <>
                <Text style={styles.subLabel}>Group Members</Text>
                <View style={styles.memberGrid}>
                  {filteredMembers.map(m => (
                    <TouchableOpacity
                      key={m.userId}
                      style={styles.memberChip}
                      onPress={() => handleAddMember(m)}
                      disabled={addingPlayerId === m.userId}
                    >
                      {addingPlayerId === m.userId
                        ? <ActivityIndicator color={colors.background} size="small" />
                        : <Text style={styles.memberChipText}>{m.username}</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={styles.divider} />

            <Text style={styles.subLabel}>Add Guest</Text>
            <View style={styles.guestRow}>
              <TextInput
                style={styles.guestInput}
                value={guestName}
                onChangeText={setGuestName}
                placeholder="Guest name"
                placeholderTextColor={colors.textDim}
              />
              <TouchableOpacity
                style={[styles.addGuestBtn, (!guestName.trim() || addingGuest) && styles.addGuestBtnDisabled]}
                onPress={handleAddGuest}
                disabled={!guestName.trim() || addingGuest}
              >
                {addingGuest
                  ? <ActivityIndicator color={colors.background} size="small" />
                  : <Text style={styles.addGuestBtnText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── End Session Modal ── */}
      <Modal visible={endModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, styles.sheetTall]}>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>End Session</Text>
              <TouchableOpacity onPress={() => setEndModal(false)} hitSlop={8}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.endSubtitle}>
              Enter final {session.chipRatio && useChips ? 'chip counts' : 'cash amounts'} for players still at the table. Leave blank to skip.
            </Text>

            <ScrollView style={styles.endPlayerList} keyboardShouldPersistTaps="handled">
              {session.players.map(p => {
                const bal = getBalance(p);
                const hasCashOut = (bal?.totalCashOut ?? 0) > 0;
                return (
                  <View key={p.sessionPlayerId} style={styles.endPlayerRow}>
                    <Text style={styles.endPlayerName}>{p.username}</Text>
                    {hasCashOut ? (
                      <Text style={styles.endPlayerCashed}>
                        Cashed {formatMoney(bal!.totalCashOut)}
                      </Text>
                    ) : (
                      <TextInput
                        style={styles.endStackInput}
                        value={finalStacks[p.sessionPlayerId] ?? ''}
                        onChangeText={v => setFinalStacks(prev => ({ ...prev, [p.sessionPlayerId]: v }))}
                        keyboardType="decimal-pad"
                        placeholder={session.chipRatio && useChips ? 'Chips' : '₪'}
                        placeholderTextColor={colors.textDim}
                      />
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.endConfirmBtn}
              onPress={handleEndSession}
              disabled={endLoading}
            >
              {endLoading
                ? <ActivityIndicator color={colors.background} />
                : <Text style={styles.endConfirmBtnText}>End Session & Calculate →</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Hand Modal ── */}
      <Modal visible={handModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Log Hand</Text>
              <TouchableOpacity onPress={() => setHandModal(false)} hitSlop={8}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subLabel}>Pot Amount</Text>
            <TextInput
              style={styles.txInput}
              value={handPot}
              onChangeText={setHandPot}
              keyboardType="decimal-pad"
              placeholder="₪"
              placeholderTextColor={colors.textDim}
            />

            <Text style={[styles.subLabel, { marginTop: 12 }]}>Winner</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.winnerScroll}>
              {session.players.map(p => (
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
            </ScrollView>

            <Text style={[styles.subLabel, { marginTop: 12 }]}>Note (optional)</Text>
            <TextInput
              style={styles.txInput}
              value={handNote}
              onChangeText={setHandNote}
              placeholder="e.g. Full house vs flush"
              placeholderTextColor={colors.textDim}
            />

            <TouchableOpacity
              style={[styles.confirmBtn, { marginTop: 16 }]}
              onPress={handleAddHand}
              disabled={handLoading}
            >
              {handLoading
                ? <ActivityIndicator color={colors.background} size="small" />
                : <Text style={styles.confirmBtnText}>Log Hand</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'Active';
  const isDraft = status === 'Draft';
  return (
    <View style={[styles.badge, isActive ? styles.badgeActive : isDraft ? styles.badgeDraft : styles.badgeFinished]}>
      {isActive && <View style={styles.activeDot} />}
      <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextMuted]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

function GuestBadge() {
  return (
    <View style={styles.guestBadge}>
      <Text style={styles.guestBadgeText}>GUEST</Text>
    </View>
  );
}

function MetaChip({ label, gold }: { label: string; gold?: boolean }) {
  return (
    <View style={[styles.metaChip, gold && styles.metaChipGold]}>
      <Text style={[styles.metaChipText, gold && styles.metaChipTextGold]}>{label}</Text>
    </View>
  );
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  backBtn: { padding: 4 },
  backArrow: { fontSize: 28, color: colors.text, lineHeight: 32 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  timer: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  chipToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  chipToggleOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.12)' },
  chipToggleText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  chipToggleTextOn: { color: colors.gold },
  exportBtn: { padding: 8 },
  exportText: { color: colors.gold, fontSize: 14, fontWeight: '600' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },

  // Meta chips
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaChipGold: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.10)' },
  metaChipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  metaChipTextGold: { color: colors.gold },

  // Sections
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  seeAll: { fontSize: 13, color: colors.gold, fontWeight: '600' },
  addPlayerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  addPlayerBtnText: { fontSize: 13, color: colors.gold, fontWeight: '600' },

  // Player list
  playerList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    minHeight: 68,
  },
  playerRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  playerRowFirst: { backgroundColor: 'rgba(201,168,76,0.06)' },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerAvatarFirst: { backgroundColor: 'rgba(201,168,76,0.20)', borderWidth: 1, borderColor: colors.gold },
  playerAvatarText: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  playerInfo: { flex: 1, gap: 2 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  playerNameFirst: { color: colors.gold },
  playerMeta: { fontSize: 12, color: colors.textMuted },
  rankLabel: { fontSize: 14 },
  playerRight: { alignItems: 'flex-end', gap: 6 },
  plValue: { fontSize: 18, fontWeight: '800' },
  plValueFirst: { fontSize: 22 },
  plPos: { color: colors.success },
  plNeg: { color: colors.error },
  plZero: { color: colors.textMuted },
  txButtons: { flexDirection: 'row', gap: 6 },
  txBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  txBtnCash: { backgroundColor: 'rgba(39,174,96,0.12)', borderColor: colors.success },
  txBtnText: { fontSize: 11, fontWeight: '700', color: colors.gold },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 16, color: colors.error },

  emptyPlayers: { padding: 24, alignItems: 'center' },
  emptyPlayersText: { color: colors.textMuted, fontSize: 14 },

  // End Session button
  endSessionBtn: {
    margin: 16,
    marginTop: 8,
    backgroundColor: 'rgba(231,76,60,0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  endSessionBtnText: { fontSize: 15, fontWeight: '700', color: colors.error },

  // "Everyone is even" empty state
  evenCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(39,174,96,0.3)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  evenIcon: { fontSize: 32, color: colors.success, fontWeight: '700' },
  evenTitle: { fontSize: 17, fontWeight: '700', color: colors.success },
  evenSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  recalcLink: { fontSize: 13, color: colors.gold, fontWeight: '600', marginTop: 4 },

  // Settlements — card design
  settlementList: { gap: 10 },
  settlementCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  settlementCardPaid: { opacity: 0.55 },
  settlementAccent: { width: 4, backgroundColor: colors.gold },
  settlementAccentPaid: { backgroundColor: colors.success },
  settlementCardInner: { flex: 1, padding: 14, gap: 10 },
  settlementFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settlementParty: { alignItems: 'center', gap: 4, flex: 1 },
  settlementPartyName: { fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'center' },
  settlementAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementAvatarReceiver: {
    backgroundColor: 'rgba(39,174,96,0.15)',
    borderColor: 'rgba(39,174,96,0.4)',
  },
  settlementAvatarText: { fontSize: 15, fontWeight: '700', color: colors.text },
  settlementMiddle: { alignItems: 'center', gap: 2, paddingHorizontal: 8 },
  settlementArrowIcon: { fontSize: 20, color: colors.textDim },
  settlementAmount: { fontSize: 20, fontWeight: '800', color: colors.gold },
  settlementActionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  markPaidBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  markPaidText: { fontSize: 13, fontWeight: '700', color: colors.background },
  badgePaidRow: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(39,174,96,0.15)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  badgePendingRow: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settlementBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Guest manual settlements
  guestManualBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guestManualBadgeText: { fontSize: 9, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5 },
  guestManualCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  guestManualSubtitle: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  guestManualRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  guestManualAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestManualAvatarOwes: { backgroundColor: 'rgba(231,76,60,0.15)', borderWidth: 1, borderColor: 'rgba(231,76,60,0.4)' },
  guestManualAvatarOwed: { backgroundColor: 'rgba(39,174,96,0.15)', borderWidth: 1, borderColor: 'rgba(39,174,96,0.4)' },
  guestManualInfo: { flex: 1, gap: 2 },
  guestManualName: { fontSize: 14, fontWeight: '700', color: colors.text },
  guestManualAction: { fontSize: 12, fontWeight: '500' },
  guestManualOwes: { color: colors.error },
  guestManualOwed: { color: colors.success },

  // Notes
  notesText: { fontSize: 14, color: colors.text, lineHeight: 21 },
  notesEdit: { gap: 8 },
  notesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  notesActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  notesCancelText: { fontSize: 14, color: colors.textMuted, fontWeight: '600', paddingVertical: 8 },
  notesSaveBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.gold, borderRadius: 8 },
  notesSaveBtnText: { fontSize: 14, fontWeight: '700', color: colors.background },

  // Hand history
  handList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  handRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  handRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  handInfo: { flex: 1, gap: 2 },
  handWinner: { fontSize: 14, fontWeight: '600', color: colors.text },
  handPot: { fontSize: 12, color: colors.gold, fontWeight: '600' },
  handNote: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  handDelete: { fontSize: 14, color: colors.error },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 88,
    right: 20,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },

  // Bottom action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  actionBarBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  actionBarBtnCash: {
    backgroundColor: 'rgba(39,174,96,0.10)',
    borderColor: colors.success,
  },
  actionBarBtnText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  actionBarBtnTextCash: { color: colors.success },

  // Preset amount chips
  presetRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.12)' },
  presetChipText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  presetChipTextActive: { color: colors.gold },

  // Player select in modal
  playerSelectScroll: { marginVertical: 4 },

  // Modal / Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 12,
  },
  sheetTall: { maxHeight: '85%' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sheetSubtitle: { fontSize: 13, color: colors.textMuted, fontWeight: '500', marginTop: 2 },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  closeBtn: { fontSize: 18, color: colors.textMuted },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHigh,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: colors.gold },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  toggleBtnTextActive: { color: colors.background },

  // Transaction inputs
  txInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 42,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 4,
  },
  txConvert: {
    textAlign: 'center',
    fontSize: 16,
    color: colors.gold,
    fontWeight: '700',
  },
  txUnit: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.textDim,
    fontWeight: '500',
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.gold,
  },
  confirmBtnCash: { backgroundColor: colors.success },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: colors.background },

  // Add player
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: colors.gold,
    minWidth: 80,
    alignItems: 'center',
  },
  memberChipText: { fontSize: 14, fontWeight: '600', color: colors.gold },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  guestRow: { flexDirection: 'row', gap: 10 },
  guestInput: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  addGuestBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGuestBtnDisabled: { opacity: 0.5 },
  addGuestBtnText: { fontSize: 14, fontWeight: '700', color: colors.background },

  // End session modal
  endSubtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  endPlayerList: { maxHeight: 280 },
  endPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  endPlayerName: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  endPlayerCashed: { fontSize: 13, color: colors.success, fontWeight: '600' },
  endStackInput: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
    width: 100,
    textAlign: 'right',
  },
  endConfirmBtn: {
    marginTop: 12,
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  endConfirmBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },

  // Hand winner
  winnerScroll: { marginVertical: 4 },
  winnerChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  winnerChipSelected: { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: colors.gold },
  winnerChipText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  winnerChipTextSelected: { color: colors.gold },

  // Status badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeActive: { backgroundColor: 'rgba(201,168,76,0.15)', borderWidth: 1, borderColor: colors.gold },
  badgeDraft: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  badgeFinished: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  badgeTextActive: { color: colors.gold },
  badgeTextMuted: { color: colors.textMuted },

  // Guest badge
  guestBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guestBadgeText: { fontSize: 9, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Misc
  emptyCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 24, alignItems: 'center', gap: 12 },
  emptySubtitle: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  retryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  metaRow2: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
