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
  Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  getSessionById,
  getSessionBalances,
  addBuyIn,
  addCashOut,
  addPlayer,
  removePlayer,
  startSession,
  endSession,
  deleteSession,
  generateSessionInviteToken,
  getSessionRecap,
  SessionDetailDto,
  SessionPlayerDto,
  PlayerBalanceDto,
  FinalStackItem,
  SessionRecapDto,
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
import RecapCard from '../components/RecapCard';
import SkeletonCard from '../components/SkeletonCard';
import { successNotification, errorNotification, lightTap } from '../utils/haptics';
import { showToast } from '../utils/toast';
import { formatMoney } from '../utils/formatters';
import { useActiveSession } from '../context/ActiveSessionContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

function toMoney(input: number, chipRatio: number | undefined, useChips: boolean): number {
  if (!useChips || !chipRatio || chipRatio === 0) return input;
  return input / chipRatio;
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
  const insets = useSafeAreaInsets();
  const { refresh: refreshActiveSession, clear: clearActiveSession } = useActiveSession();

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

  // End session modal — 0=closed, 1=confirm/skip, 2=final stacks, 3=game over summary
  const [endStep, setEndStep] = useState<0 | 1 | 2 | 3>(0);
  const [endSummary, setEndSummary] = useState<{ players: PlayerBalanceDto[]; settlements: SettlementDto[] } | null>(null);
  const [finalStacks, setFinalStacks] = useState<Record<string, string>>({});
  const [endLoading, setEndLoading] = useState(false);
  const [overrideBalance, setOverrideBalance] = useState(false);

  // Start session (Draft → Active)
  const [startLoading, setStartLoading] = useState(false);

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
  const [sharingSummary, setSharingSummary] = useState(false);
  const [sharingInvite, setSharingInvite] = useState(false);

  // Session recap
  const [recap, setRecap] = useState<SessionRecapDto | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);

  // Delete session
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Timer ticker for active sessions
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = session?.status === 'Active';
  const isDraft = session?.status === 'Draft';
  const isFinished = session?.status === 'Finished';
  const isAdminOrOwner = myRole === 'Admin' || myRole === 'Owner'
    || (session?.groupId == null && session?.creatorId === user?.userId);

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
          if (!recap) setRecapLoading(true);
          const [settData, recapData] = await Promise.all([
            getSessionSettlements(token, sessionId).catch(() => null),
            getSessionRecap(token, sessionId).catch(() => null),
          ]);
          setRecapLoading(false);
          if (settData) {
            setSettlements(settData.settlements);
            setSettlementsLoaded(true);
          }
          if (recapData) setRecap(recapData);
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
    refreshActiveSession();
  }, [load, refreshActiveSession]));

  // Timer for active sessions — ticks every 30s (updates duration display + reloads data)
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTick(t => t + 1);
        load(true);
      }, 30000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, load]);

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
      showToast(txModal.type === 'buyin' ? 'Buy-in recorded' : 'Cash-out recorded', 'success');
      setTxModal({ visible: false, type: 'buyin', player: null, needsPlayerSelect: false });
      await load(true);
    } catch (e: any) {
      errorNotification();
      showToast(e?.response?.data?.message ?? 'Failed to record transaction.', 'error');
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
    setEndSummary(null);
    setOverrideBalance(false);
    setEndStep(1);
  }

  async function handleStartSession() {
    setStartLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await startSession(token, sessionId);
      successNotification();
      await load(true);
    } catch (e: any) {
      errorNotification();
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to start session.');
    } finally {
      setStartLoading(false);
    }
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
      // Update local session status immediately so the screen renders Finished state
      // without needing a full reload (which could trigger the 401 → logout path).
      setSession(s => s ? { ...s, status: 'Finished', endedAt: new Date().toISOString() } : s);
      clearActiveSession();

      const [balData, calcResult] = await Promise.all([
        getSessionBalances(token, sessionId).catch(() => null),
        calculateSettlements(token, sessionId).catch(() => ({ settlements: [], guestBalances: [] })),
      ]);

      if (balData) setBalances(balData.players);
      setSettlements(calcResult.settlements);
      setGuestBalances(calcResult.guestBalances);
      setSettlementsLoaded(true);
      setEndSummary({ players: balData?.players ?? [], settlements: calcResult.settlements });
      successNotification();
      setEndStep(3);
    } catch (e: any) {
      errorNotification();
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to end session.');
    } finally {
      setEndLoading(false);
    }
  }

  function finishGame() {
    setEndStep(0);
    setEndSummary(null);
    // State is already fresh from handleEndSession; useFocusEffect reloads on next focus.
    // Removed load(true) here — it could trigger 401 → clearSession → Login redirect.
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
      showToast('Payment confirmed', 'success');
    } catch {
      Alert.alert('Error', 'Failed to mark as paid.');
    } finally {
      setMarkingPaidId(null);
    }
  }

  function confirmMarkPaid(settlementId: string, payerName: string, receiverName: string, amount: number) {
    Alert.alert(
      'Confirm Payment',
      `${payerName} paid ${formatMoney(amount)} to ${receiverName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => handleMarkPaid(settlementId) },
      ],
    );
  }

  async function handleShareSettlements() {
    if (settlements.length === 0 || !session) return;
    setSharingSummary(true);
    try {
      const lines = settlements.map(s => {
        const tag = s.status === 'Confirmed' ? ' ✓' : '';
        return `${s.payerName} → ${s.receiverName}: ${formatMoney(s.amount)}${tag}`;
      });
      const text = `${session.name} — Settlements:\n\n${lines.join('\n')}`;
      try {
        await Share.share({ message: text });
      } catch {
        if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
          await (navigator as any).clipboard.writeText(text);
          showToast('Copied to clipboard!', 'success');
        }
      }
    } finally {
      setSharingSummary(false);
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
      await shareSessionCard(session.name, session.groupName ?? '', date, dur, balances, settlements, recap?.highlights);
    } catch (e: any) {
      Alert.alert('Share Failed', e?.message ?? 'Could not generate share card.');
    } finally {
      setSharing(false);
    }
  }

  // ── Invite Link ──

  async function handleShareInvite() {
    setSharingInvite(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const result = await generateSessionInviteToken(token, sessionId);
      await Share.share({
        message: `Join my poker session "${session?.name}"!\n\n${result.deepLinkUrl}`,
        url: result.deepLinkUrl,
      });
    } catch (e: any) {
      if (e?.message !== 'The user did not share') {
        Alert.alert('Error', e?.response?.data?.message ?? 'Failed to generate invite link.');
      }
    } finally {
      setSharingInvite(false);
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
      <View style={styles.flex}>
        {/* skeleton header */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={styles.backBtn} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonCard height={16} borderRadius={6} style={{ width: '55%' }} />
            <SkeletonCard height={10} borderRadius={4} style={{ width: '30%' }} />
          </View>
        </View>
        {/* skeleton meta chips */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
          <SkeletonCard height={28} borderRadius={8} style={{ width: 90 }} />
          <SkeletonCard height={28} borderRadius={8} style={{ width: 70 }} />
        </View>
        {/* skeleton player list */}
        <View style={{ marginTop: 8, paddingHorizontal: 16 }}>
          <SkeletonCard height={10} borderRadius={4} style={{ width: '25%', marginBottom: 12 }} />
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <SkeletonCard height={36} borderRadius={10} style={{ width: 36, flexShrink: 0 }} />
                <View style={{ flex: 1, gap: 7 }}>
                  <SkeletonCard height={13} borderRadius={4} style={{ width: '45%' }} />
                  <SkeletonCard height={9} borderRadius={3} style={{ width: '60%' }} />
                </View>
                <SkeletonCard height={18} borderRadius={4} style={{ width: 52 }} />
              </View>
            ))}
          </View>
        </View>
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
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
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
            </View>
          </View>
          {isFinished && (
            <TouchableOpacity onPress={handleExport} style={styles.exportBtn} disabled={exporting}>
              {exporting ? <ActivityIndicator color={colors.gold} size="small" /> : <Text style={styles.exportText}>CSV</Text>}
            </TouchableOpacity>
          )}
          {isFinished && balances.length > 0 && (
            <TouchableOpacity onPress={handleShareCard} style={styles.exportBtn} disabled={sharing}>
              {sharing
                ? <ActivityIndicator color={colors.gold} size="small" />
                : <Ionicons name="share-outline" size={16} color={colors.gold} />}
            </TouchableOpacity>
          )}
          {isAdminOrOwner && (isActive || isDraft) && (
            <TouchableOpacity onPress={handleShareInvite} style={styles.exportBtn} disabled={sharingInvite} hitSlop={8}>
              {sharingInvite
                ? <ActivityIndicator color={colors.gold} size="small" />
                : <Ionicons name="person-add-outline" size={16} color={colors.gold} />}
            </TouchableOpacity>
          )}
          {isAdminOrOwner && !isActive && (
            <TouchableOpacity onPress={handleDeleteSession} style={styles.deleteBtn} disabled={deleteLoading} hitSlop={8}>
              {deleteLoading
                ? <ActivityIndicator color={colors.error} size="small" />
                : <Ionicons name="trash-outline" size={16} color={colors.error} />}
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

        {/* ── Chip/Money toggle pill (only when chipRatio set) ── */}
        {session.chipRatio ? (
          <View style={styles.chipPillRow}>
            <Text style={styles.chipPillLabel}>Display:</Text>
            <TouchableOpacity
              style={[styles.chipPill, !useChips && styles.chipPillActive]}
              onPress={() => setUseChips(false)}
            >
              <Text style={[styles.chipPillText, !useChips && styles.chipPillTextActive]}>₪ Money</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chipPill, useChips && styles.chipPillActive]}
              onPress={() => setUseChips(true)}
            >
              <Text style={[styles.chipPillText, useChips && styles.chipPillTextActive]}>🪙 Chips</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Current Standings (Active, 2+ players with balance data) ── */}
        {isActive && balances.length >= 2 && (
          <View style={styles.standingsRow}>
            <Text style={styles.standingsLabel}>STANDINGS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.standingsScroll}>
              {[...balances]
                .sort((a, b) => b.profitLoss - a.profitLoss)
                .map((b, i) => {
                  const isLeader = i === 0;
                  const isTrailing = i === balances.length - 1 && balances.length > 1;
                  return (
                    <View key={b.sessionPlayerId} style={[
                      styles.standingChip,
                      isLeader && styles.standingChipLeader,
                      isTrailing && !isLeader && styles.standingChipTrailing,
                    ]}>
                      <Text style={[styles.standingName, isLeader && styles.standingNameLeader]} numberOfLines={1}>
                        {isLeader ? '▲ ' : isTrailing ? '▼ ' : ''}{b.username}
                      </Text>
                      <Text style={[
                        styles.standingPL,
                        b.profitLoss > 0 ? styles.standingPos : b.profitLoss < 0 ? styles.standingNeg : styles.standingZero,
                      ]}>
                        {b.profitLoss > 0 ? '+' : ''}{formatMoney(b.profitLoss)}
                      </Text>
                    </View>
                  );
                })}
            </ScrollView>
          </View>
        )}

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
                        <TouchableOpacity
                          onPress={() => player.userId && navigation.navigate('PlayerProfile', { userId: player.userId, username: player.username })}
                          disabled={!player.userId}
                          activeOpacity={player.userId ? 0.6 : 1}
                        >
                          <Text style={[styles.playerName, isFirst && styles.playerNameFirst]}>
                            {player.username}
                          </Text>
                        </TouchableOpacity>
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

                    {/* P&L */}
                    {(isActive || isFinished) && bal ? (
                      <View style={styles.playerRight}>
                        <Text style={[
                          styles.plValue,
                          pl > 0 ? styles.plPos : pl < 0 ? styles.plNeg : styles.plZero,
                          isFirst && styles.plValueFirst,
                        ]}>
                          {pl > 0 ? '+' : ''}{formatMoney(pl)}
                        </Text>
                      </View>
                    ) : isDraft ? (
                      <TouchableOpacity
                        onPress={() => handleRemovePlayer(player)}
                        style={styles.removeBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="close" size={14} color={colors.error} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>


        {/* ── Session Recap (Finished) ── */}
        {isFinished && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Game Highlights</Text>
            <RecapCard
              recap={recap}
              loading={recapLoading}
              onShare={handleShareCard}
              sharing={sharing}
            />
          </View>
        )}

        {/* ── Settlements (Finished) ── */}
        {isFinished && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Settlements</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {settlements.length > 0 && (
                  <TouchableOpacity onPress={handleShareSettlements} disabled={sharingSummary} hitSlop={8}>
                    {sharingSummary
                      ? <ActivityIndicator color={colors.gold} size="small" />
                      : <Ionicons name="share-outline" size={17} color={colors.gold} />}
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleCalculateSettlements} disabled={calcLoading}>
                  {calcLoading
                    ? <ActivityIndicator color={colors.gold} size="small" />
                    : <Text style={styles.seeAll}>Recalculate</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {settlements.length === 0 ? (
              <View style={styles.evenCard}>
                <Ionicons name="checkmark-circle" size={36} color={colors.success} />
                <Text style={styles.evenTitle}>Everyone is even</Text>
                <Text style={styles.evenSub}>No transfers needed — the math works out perfectly.</Text>
                <TouchableOpacity onPress={handleCalculateSettlements} disabled={calcLoading}>
                  {calcLoading
                    ? <ActivityIndicator color={colors.gold} size="small" />
                    : <Text style={styles.recalcLink}>Recalculate</Text>}
                </TouchableOpacity>
              </View>
            ) : settlements.every(s => s.status === 'Confirmed') ? (
              <View style={styles.evenCard}>
                <Ionicons name="checkmark-circle" size={36} color={colors.success} />
                <Text style={styles.evenTitle}>All settled up! 🎉</Text>
                <Text style={styles.evenSub}>Everyone's even. See you next game.</Text>
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
                            <Ionicons name="arrow-forward" size={16} color={colors.textDim} />
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
                              onPress={() => confirmMarkPaid(s.id, s.payerName, s.receiverName, s.amount)}
                              disabled={markingPaidId === s.id}
                            >
                              {markingPaidId === s.id
                                ? <ActivityIndicator color={colors.background} size="small" />
                                : (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="checkmark" size={14} color={colors.background} />
                                    <Text style={styles.markPaidText}>Mark Paid</Text>
                                  </View>
                                )}
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
                        <View style={styles.handDeleteWrap}><Ionicons name="trash-outline" size={13} color={colors.error} /></View>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: isDraft ? (isAdminOrOwner ? 110 : 40) : isActive ? (isAdminOrOwner ? 240 : 160) : 60 }} />
      </ScrollView>

      {/* ── START GAME bar (Draft, Admin/Owner) ── */}
      {isDraft && isAdminOrOwner && (
        <View style={styles.startGameBar}>
          <TouchableOpacity
            style={styles.startGameBtn}
            onPress={handleStartSession}
            disabled={startLoading}
            activeOpacity={0.85}
          >
            {startLoading
              ? <ActivityIndicator color={colors.background} size="small" />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="play-circle-outline" size={18} color={colors.background} />
                  <Text style={styles.startGameBtnText}>START GAME</Text>
                </View>
              )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Floating Log Hand button (Active) ── */}
      {isActive && (
        <TouchableOpacity
          style={[styles.fab, isAdminOrOwner && { bottom: Platform.OS === 'ios' ? 158 : 140 }]}
          onPress={() => { setHandPot(''); setHandWinner(''); setHandNote(''); setHandModal(true); }}
        >
          <Text style={styles.fabText}>+ Hand</Text>
        </TouchableOpacity>
      )}

      {/* ── End Game sticky CTA (Active, Admin/Owner, above action bar) ── */}
      {isActive && isAdminOrOwner && (
        <TouchableOpacity style={styles.endGameBar} onPress={openEndModal} activeOpacity={0.85}>
          <Text style={styles.endGameBarText}>🏁  End Game</Text>
        </TouchableOpacity>
      )}

      {/* ── Bottom Action Bar (Active sessions only) ── */}
      {isActive && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionBarBtn} onPress={() => openActionBar('buyin')} activeOpacity={0.8}>
            <Text style={styles.actionBarBtnIcon}>+</Text>
            <Text style={styles.actionBarBtnText}>Buy In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBarBtn} onPress={() => openActionBar('buyin')} activeOpacity={0.8}>
            <Text style={styles.actionBarBtnIcon}>↺</Text>
            <Text style={styles.actionBarBtnText}>Rebuy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBarBtn, styles.actionBarBtnCash]} onPress={() => openActionBar('cashout')} activeOpacity={0.8}>
            <Text style={[styles.actionBarBtnIcon, styles.actionBarBtnIconCash]}>$</Text>
            <Text style={[styles.actionBarBtnText, styles.actionBarBtnTextCash]}>Cash Out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBarBtn, styles.actionBarBtnPlayer]}
            onPress={() => { setAddPlayerModal(true); setPlayerSearch(''); setGuestName(''); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBarBtnIcon, styles.actionBarBtnIconPlayer]}>＋</Text>
            <Text style={[styles.actionBarBtnText, styles.actionBarBtnTextPlayer]}>Player</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Transaction Modal ── */}
      <Modal visible={txModal.visible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <View>
                <Text style={styles.sheetTitle}>
                  {txModal.type === 'buyin' ? 'Buy In' : 'Cash Out'}
                </Text>
                {txModal.player && <Text style={styles.sheetSubtitle}>{txModal.player.username}</Text>}
              </View>
              <TouchableOpacity onPress={() => setTxModal({ visible: false, type: 'buyin', player: null, needsPlayerSelect: false })} hitSlop={8}>
                <View style={styles.closeBtnWrap}><Ionicons name="close" size={16} color={colors.textMuted} /></View>
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
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Add Player</Text>
              <TouchableOpacity onPress={() => setAddPlayerModal(false)} hitSlop={8}>
                <View style={styles.closeBtnWrap}><Ionicons name="close" size={16} color={colors.textMuted} /></View>
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

      {/* ── End Session Modal (Step 1: Confirm / Skip intent) ── */}
      <Modal visible={endStep === 1} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Wrap Up?</Text>

            <View style={styles.endInfoCard}>
              <View style={styles.endInfoRow}>
                <Text style={styles.endInfoLabel}>Players</Text>
                <Text style={styles.endInfoValue}>{session.players.length}</Text>
              </View>
              <View style={styles.endInfoRow}>
                <Text style={styles.endInfoLabel}>Total pot</Text>
                <Text style={[styles.endInfoValue, { color: colors.gold }]}>{formatMoney(totalPot)}</Text>
              </View>
              {session.startedAt && (
                <View style={styles.endInfoRow}>
                  <Text style={styles.endInfoLabel}>Duration</Text>
                  <Text style={styles.endInfoValue}>{formatDuration(session.startedAt, null, tick)}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.endOptionBtn} onPress={() => setEndStep(2)} activeOpacity={0.8}>
              <View style={styles.endOptionIconWrap}><Ionicons name="list-outline" size={18} color={colors.gold} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.endOptionTitle}>Enter Final {session.chipRatio ? 'Chip Counts' : 'Cash Amounts'}</Text>
                <Text style={styles.endOptionSub}>Recommended — most accurate results</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.gold} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.endOptionBtn, styles.endOptionBtnSecondary]}
              onPress={() => handleEndSession()}
              disabled={endLoading}
              activeOpacity={0.8}
            >
              {endLoading ? (
                <ActivityIndicator color={colors.textMuted} size="small" style={{ flex: 1 }} />
              ) : (
                <>
                  <View style={styles.endOptionIconWrap}><Ionicons name="flash-outline" size={18} color={colors.textMuted} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.endOptionTitle, { color: colors.textMuted }]}>Skip — Use Transaction Records</Text>
                    <Text style={styles.endOptionSub}>Calculate from recorded buy-ins and cash-outs</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.gold} />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.endCancelRow} onPress={() => setEndStep(0)}>
              <Text style={styles.endCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── End Session Modal (Step 2: Final Stacks + Live Validation) ── */}
      <Modal visible={endStep === 2} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, styles.sheetTall]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <View>
                <Text style={styles.sheetTitle}>Final {session.chipRatio && useChips ? 'Chip Counts' : 'Cash Amounts'}</Text>
                <Text style={styles.endSubtitle}>Enter what each player has left at the table.</Text>
              </View>
              <TouchableOpacity onPress={() => setEndStep(1)} hitSlop={8}>
                <View style={styles.closeBtnWrap}><Ionicons name="close" size={16} color={colors.textMuted} /></View>
              </TouchableOpacity>
            </View>

            {session.chipRatio && (
              <View style={styles.toggleRow}>
                <TouchableOpacity style={[styles.toggleBtn, !useChips && styles.toggleBtnActive]} onPress={() => setUseChips(false)}>
                  <Text style={[styles.toggleBtnText, !useChips && styles.toggleBtnTextActive]}>₪ Money</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, useChips && styles.toggleBtnActive]} onPress={() => setUseChips(true)}>
                  <Text style={[styles.toggleBtnText, useChips && styles.toggleBtnTextActive]}>🪙 Chips</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={styles.endPlayerList} keyboardShouldPersistTaps="handled">
              {session.players.map(p => {
                const bal = getBalance(p);
                const hasCashOut = (bal?.totalCashOut ?? 0) > 0;
                return (
                  <View key={p.sessionPlayerId} style={styles.endPlayerRow}>
                    <View style={[styles.endPlayerAvatar]}>
                      <Text style={styles.endPlayerAvatarText}>{p.username[0].toUpperCase()}</Text>
                    </View>
                    <Text style={styles.endPlayerName}>{p.username}</Text>
                    {hasCashOut ? (
                      <Text style={styles.endPlayerCashed}>Cashed {formatMoney(bal!.totalCashOut)}</Text>
                    ) : (
                      <TextInput
                        style={styles.endStackInput}
                        value={finalStacks[p.sessionPlayerId] ?? ''}
                        onChangeText={v => {
                          setFinalStacks(prev => ({ ...prev, [p.sessionPlayerId]: v }));
                          setOverrideBalance(false);
                        }}
                        keyboardType="decimal-pad"
                        placeholder={session.chipRatio && useChips ? 'chips' : '₪'}
                        placeholderTextColor={colors.textDim}
                      />
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Live chip/money validation */}
            {(() => {
              const totalCashedOut = balances.reduce((s, b) => s + b.totalCashOut, 0);
              const expectedRemaining = totalPot - totalCashedOut;
              const expectedInUnits = session.chipRatio && useChips
                ? expectedRemaining * session.chipRatio
                : expectedRemaining;
              const totalEntered = Object.entries(finalStacks)
                .filter(([, v]) => v.trim() !== '' && !isNaN(parseFloat(v)) && parseFloat(v) >= 0)
                .reduce((sum, [, v]) => sum + parseFloat(v), 0);
              const hasAnyEntered = Object.values(finalStacks).some(v => v.trim() !== '');
              const diff = totalEntered - expectedInUnits;
              const isBalanced = !hasAnyEntered || Math.abs(diff) < 0.5;
              const unitLabel = session.chipRatio && useChips ? 'chips' : '₪';
              const fmt = (n: number) => session.chipRatio && useChips
                ? Math.round(n).toLocaleString()
                : formatMoney(n);
              const blocked = hasAnyEntered && !isBalanced && !overrideBalance;

              return (
                <>
                  {hasAnyEntered && (
                    <View style={[styles.chipCounter, isBalanced ? styles.chipCounterOk : styles.chipCounterWarn]}>
                      <View style={styles.chipCounterRow}>
                        <Text style={styles.chipCounterLabel}>Entered</Text>
                        <Text style={[styles.chipCounterValue, isBalanced ? styles.chipCounterValueOk : styles.chipCounterValueWarn]}>
                          {fmt(totalEntered)} {unitLabel}
                        </Text>
                      </View>
                      <View style={styles.chipCounterRow}>
                        <Text style={styles.chipCounterLabel}>Expected</Text>
                        <Text style={styles.chipCounterValue}>{fmt(expectedInUnits)} {unitLabel}</Text>
                      </View>
                      {isBalanced
                        ? (
                          <View style={styles.chipCounterMatchRow}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                            <Text style={styles.chipCounterMatch}>Totals match</Text>
                          </View>
                        )
                        : <Text style={styles.chipCounterDiff}>
                            {diff > 0 ? '+' : ''}{fmt(Math.abs(diff))} {diff > 0 ? 'over' : 'short'}
                          </Text>
                      }
                    </View>
                  )}

                  {!isBalanced && (
                    <TouchableOpacity
                      style={styles.overrideRow}
                      onPress={() => setOverrideBalance(v => !v)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.overrideCheckbox, overrideBalance && styles.overrideCheckboxChecked]}>
                        {overrideBalance && <Ionicons name="checkmark" size={12} color={colors.background} />}
                      </View>
                      <Text style={styles.overrideLabel}>Calculate anyway (totals don't balance)</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.endConfirmBtn, blocked && styles.endConfirmBtnDisabled]}
                    onPress={handleEndSession}
                    disabled={endLoading || blocked}
                  >
                    {endLoading
                      ? <ActivityIndicator color={styles.endConfirmBtnText.color as string} />
                      : <Text style={styles.endConfirmBtnText}>Calculate Results →</Text>}
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── End Session Modal (Step 3: Game Over Summary) ── */}
      <Modal visible={endStep === 3} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, styles.sheetTall]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.summaryTitle}>🏆 Game Over!</Text>
            <Text style={styles.summarySessionName}>{session.name}</Text>

            {/* Stats row */}
            <View style={styles.summaryStatsRow}>
              {session.startedAt && (
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>{formatDuration(session.startedAt, new Date().toISOString())}</Text>
                  <Text style={styles.summaryStatLabel}>Duration</Text>
                </View>
              )}
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryStatValue, { color: colors.gold }]}>{formatMoney(totalPot)}</Text>
                <Text style={styles.summaryStatLabel}>Pot</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>{endSummary?.players.length ?? 0}</Text>
                <Text style={styles.summaryStatLabel}>Players</Text>
              </View>
            </View>

            {/* Biggest winner / loser highlights */}
            {endSummary && endSummary.players.length > 0 && (() => {
              const sorted = [...endSummary.players].sort((a, b) => b.profitLoss - a.profitLoss);
              const winner = sorted[0];
              const loser = sorted[sorted.length - 1];
              if (winner === loser) return null;
              return (
                <View style={styles.summaryHighlights}>
                  {winner.profitLoss > 0 && (
                    <View style={[styles.summaryHighlight, styles.summaryHighlightWin]}>
                      <Text style={styles.summaryHighlightEmoji}>🏆</Text>
                      <View style={{ gap: 1 }}>
                        <Text style={styles.summaryHighlightName} numberOfLines={1}>{winner.username}</Text>
                        <Text style={[styles.summaryHighlightAmount, { color: colors.success }]}>+{formatMoney(winner.profitLoss)}</Text>
                      </View>
                    </View>
                  )}
                  {loser.profitLoss < 0 && (
                    <View style={[styles.summaryHighlight, styles.summaryHighlightLoss]}>
                      <Text style={styles.summaryHighlightEmoji}>💸</Text>
                      <View style={{ gap: 1 }}>
                        <Text style={styles.summaryHighlightName} numberOfLines={1}>{loser.username}</Text>
                        <Text style={[styles.summaryHighlightAmount, { color: colors.error }]}>{formatMoney(loser.profitLoss)}</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })()}

            <ScrollView style={styles.endPlayerList} showsVerticalScrollIndicator={false}>
              {/* Results */}
              <Text style={styles.summarySection}>Results</Text>
              {[...(endSummary?.players ?? [])]
                .sort((a, b) => b.profitLoss - a.profitLoss)
                .map((p, i) => (
                  <View key={p.sessionPlayerId} style={styles.summaryPlayerRow}>
                    <Text style={styles.summaryRank}>{rankLabel(i + 1)}</Text>
                    <Text style={styles.summaryPlayerName}>{p.username}</Text>
                    <Text style={[styles.summaryPL,
                      p.profitLoss > 0 ? styles.plPos : p.profitLoss < 0 ? styles.plNeg : styles.plZero]}>
                      {p.profitLoss > 0 ? '+' : ''}{formatMoney(p.profitLoss)}
                    </Text>
                  </View>
                ))}

              {/* Settlements with inline Mark Paid */}
              {(endSummary?.settlements ?? []).length > 0 && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.summarySection}>Settlements</Text>
                  {(endSummary?.settlements ?? []).map(s => {
                    const isPaid = s.status === 'Confirmed';
                    return (
                      <View key={s.id} style={styles.summarySettlementCard}>
                        <View style={styles.summarySettlementInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <Text style={styles.summarySettlementPayer}>{s.payerName}</Text>
                            <Ionicons name="arrow-forward" size={12} color={colors.textDim} />
                            <Text style={styles.summarySettlementReceiver}>{s.receiverName}</Text>
                          </View>
                          <Text style={styles.summarySettlementAmount}>{formatMoney(s.amount)}</Text>
                        </View>
                        {!isPaid ? (
                          <TouchableOpacity
                            style={styles.summaryMarkPaidBtn}
                            onPress={() => handleMarkPaid(s.id)}
                            disabled={markingPaidId === s.id}
                          >
                            {markingPaidId === s.id
                              ? <ActivityIndicator size="small" color={colors.background} />
                              : <Text style={styles.summaryMarkPaidText}>Mark Paid</Text>}
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.summaryPaidBadge}>
                            <Text style={styles.summaryPaidBadgeText}>PAID</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.finishGameBtn} onPress={finishGame} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.background} />
              <Text style={styles.finishGameBtnText}>Save Results →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Hand Modal ── */}
      <Modal visible={handModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Log Hand</Text>
              <TouchableOpacity onPress={() => setHandModal(false)} hitSlop={8}>
                <View style={styles.closeBtnWrap}><Ionicons name="close" size={16} color={colors.textMuted} /></View>
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

const RANK_COLORS: Record<number, string> = { 1: '#C9A84C', 2: '#8DA9C4', 3: '#B87333' };

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle: { ...typography.h3, color: colors.text },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  timer: {
    fontSize: 12,
    color: colors.gold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  exportBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exportText: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.errorFaint,
    borderWidth: 1,
    borderColor: colors.errorMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 16 },

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
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    minHeight: 72,
  },
  playerRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  playerRowFirst: {
    backgroundColor: colors.goldFaint,
  },
  playerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playerAvatarFirst: {
    backgroundColor: colors.goldSubtle,
    borderWidth: 1.5,
    borderColor: colors.goldMuted,
  },
  playerAvatarText: { fontSize: 16, fontWeight: '800', color: colors.textMuted },
  playerInfo: { flex: 1, gap: 3 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerName: { ...typography.label, color: colors.text },
  playerNameFirst: { color: colors.gold },
  playerMeta: { ...typography.caption, color: colors.textMuted },
  rankLabel: { fontSize: 14 },
  playerRight: { alignItems: 'flex-end', gap: 8 },
  plValue: { ...typography.amount, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  plValueFirst: { fontSize: 22, fontWeight: '800' },
  plPos: { color: colors.success },
  plNeg: { color: colors.error },
  plZero: { color: colors.textMuted },
  // Current Standings strip (active session)
  standingsRow: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  standingsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  standingsScroll: { gap: 8, paddingRight: 4 },
  standingChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 80,
  },
  standingChipLeader: {
    borderColor: colors.goldMuted,
    backgroundColor: colors.goldFaint,
  },
  standingChipTrailing: {
    borderColor: 'rgba(231,76,60,0.25)',
  },
  standingName: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 2 },
  standingNameLeader: { color: colors.goldLight },
  standingPL: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] as const },
  standingPos: { color: colors.success },
  standingNeg: { color: colors.error },
  standingZero: { color: colors.textMuted },

  txButtons: { flexDirection: 'row', gap: 6 },
  txBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    minWidth: 42,
    alignItems: 'center',
  },
  txBtnCash: { backgroundColor: 'rgba(39,174,96,0.10)', borderColor: 'rgba(39,174,96,0.3)' },
  txBtnText: { fontSize: 11, fontWeight: '800', color: colors.gold, letterSpacing: 0.3 },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.errorFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyPlayers: { padding: 28, alignItems: 'center', gap: 6 },
  emptyPlayersText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  // End Game sticky CTA bar
  endGameBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 98 : 80,
    left: 16,
    right: 16,
    backgroundColor: colors.error,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 12,
    shadowColor: colors.error,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  endGameBarText: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },

  // Chip/Money pill toggle row
  chipPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chipPillLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  chipPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipPillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipPillText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipPillTextActive: { color: colors.background },

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
  handDeleteWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: colors.errorFaint,
    borderWidth: 1,
    borderColor: colors.errorMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 92 : 76,
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
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    paddingTop: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  actionBarBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: colors.gold,
    gap: 2,
  },
  actionBarBtnCash: {
    backgroundColor: 'rgba(39,174,96,0.10)',
    borderColor: colors.success,
  },
  actionBarBtnPlayer: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
  },
  actionBarBtnIcon: { fontSize: 14, fontWeight: '800', color: colors.gold, lineHeight: 16 },
  actionBarBtnIconCash: { color: colors.success },
  actionBarBtnIconPlayer: { color: colors.textMuted },
  actionBarBtnText: { fontSize: 11, fontWeight: '700', color: colors.gold },
  actionBarBtnTextCash: { color: colors.success },
  actionBarBtnTextPlayer: { color: colors.textMuted },

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
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTall: { maxHeight: '85%' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sheetSubtitle: { fontSize: 13, color: colors.textMuted, fontWeight: '500', marginTop: 2 },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  closeBtnWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  // Summary modal (Step 2)
  summaryTitle: { fontSize: 26, fontWeight: '800', color: colors.gold, textAlign: 'center' },
  summarySessionName: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  summaryDuration: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  summarySection: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 4,
  },
  summaryPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryRank: { fontSize: 18, width: 30, textAlign: 'center' },
  summaryPlayerName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  summaryPL: { fontSize: 16, fontWeight: '800' },
  summarySettlementRow: { paddingVertical: 6 },
  summarySettlementText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  summarySettlementPayer: { fontWeight: '700', color: colors.error },
  summarySettlementReceiver: { fontWeight: '700', color: colors.success },
  summarySettlementAmount: { fontWeight: '800', color: colors.gold },
  finishGameBtn: {
    marginTop: 4,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishGameBtnText: { fontSize: 15, fontWeight: '800', color: colors.background },

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

  // Quick tx buttons on player row
  quickTxBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: colors.gold,
    gap: 1,
    minWidth: 40,
  },
  quickTxBtnOut: {
    backgroundColor: 'rgba(39,174,96,0.10)',
    borderColor: colors.success,
  },
  quickTxIcon: { fontSize: 14, fontWeight: '800', color: colors.gold, lineHeight: 16 },
  quickTxIconOut: { color: colors.success },
  quickTxLabel: { fontSize: 10, fontWeight: '700', color: colors.gold },
  quickTxLabelOut: { color: colors.success },

  // Start Game bar
  startGameBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
  },
  startGameBtn: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  startGameBtnText: { fontSize: 16, fontWeight: '800', color: colors.background, letterSpacing: 0.5 },

  // End Game — Step 1 info card
  endInfoCard: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  endInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  endInfoLabel: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  endInfoValue: { fontSize: 14, fontWeight: '700', color: colors.text },

  // End Game — option buttons
  endOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  endOptionBtnSecondary: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
  },
  endOptionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOptionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  endOptionSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  endOptionChevron: { fontSize: 22, color: colors.textMuted, fontWeight: '300' },
  endCancelRow: { alignItems: 'center', paddingVertical: 8 },
  endCancelText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },

  // End Game — Step 2 player avatar in list
  endPlayerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  endPlayerAvatarText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },

  // Disabled confirm button
  endConfirmBtnDisabled: { opacity: 0.4 },

  // Chip counter validation block
  chipCounter: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  chipCounterOk: { backgroundColor: 'rgba(39,174,96,0.08)', borderColor: 'rgba(39,174,96,0.35)' },
  chipCounterWarn: { backgroundColor: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.35)' },
  chipCounterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipCounterLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  chipCounterValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipCounterValueOk: { color: colors.success },
  chipCounterValueWarn: { color: colors.error },
  chipCounterMatchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  chipCounterMatch: { fontSize: 12, color: colors.success, fontWeight: '700' },
  chipCounterDiff: { fontSize: 12, color: colors.error, fontWeight: '700', textAlign: 'center' },

  // Override balance checkbox row
  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  overrideCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overrideCheckboxChecked: { backgroundColor: colors.gold, borderColor: colors.gold },
  overrideCheckmark: { fontSize: 13, color: colors.background, fontWeight: '800' },
  overrideLabel: { flex: 1, fontSize: 13, color: colors.textMuted, fontWeight: '500' },

  // Game Over summary — stats row
  summaryStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 4 },
  summaryStat: { alignItems: 'center', gap: 2 },
  summaryStatValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  summaryStatLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Game Over summary — highlights (biggest winner/loser)
  summaryHighlights: { flexDirection: 'row', gap: 8 },
  summaryHighlight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  summaryHighlightWin: { backgroundColor: 'rgba(39,174,96,0.08)', borderColor: 'rgba(39,174,96,0.30)' },
  summaryHighlightLoss: { backgroundColor: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.30)' },
  summaryHighlightEmoji: { fontSize: 20 },
  summaryHighlightName: { fontSize: 13, fontWeight: '700', color: colors.text },
  summaryHighlightAmount: { fontSize: 13, fontWeight: '800' },

  // Game Over summary — settlement cards
  summarySettlementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHigh,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 10,
  },
  summarySettlementInfo: { flex: 1, gap: 2 },
  summarySettlementLine: { fontSize: 14, lineHeight: 20 },
  summaryMarkPaidBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: colors.gold,
  },
  summaryMarkPaidText: { fontSize: 12, fontWeight: '700', color: colors.background },
  summaryPaidBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(39,174,96,0.15)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  summaryPaidBadgeText: { fontSize: 10, fontWeight: '700', color: colors.success, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Misc
  emptyCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 24, alignItems: 'center', gap: 12 },
  emptySubtitle: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  retryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  metaRow2: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
