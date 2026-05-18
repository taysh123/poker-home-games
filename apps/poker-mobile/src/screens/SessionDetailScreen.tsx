import React, { useCallback, useEffect, useState } from 'react';
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
import { getGroupMembers, GroupMemberDto } from '../api/groupsApi';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionDetail'>;

type TransactionModal = {
  visible: boolean;
  type: 'buyin' | 'cashout';
  player: { userId: string; username: string } | null;
};

export default function SessionDetailScreen({ route, navigation }: Props) {
  const { sessionId, sessionName } = route.params;
  const { user } = useAuth();

  const [session, setSession] = useState<SessionDetailDto | null>(null);
  const [balances, setBalances] = useState<SessionBalancesDto | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMemberDto[]>([]);
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
      const [membersData, balancesData] = await Promise.all([
        getGroupMembers(token, sessionData.groupId),
        getSessionBalances(token, sessionId),
      ]);

      setSession(sessionData);
      setGroupMembers(membersData);
      setBalances(balancesData);

      const me = membersData.find((m) => m.userId === user?.userId);
      setMyRole(me?.role ?? 'Member');
    } catch {
      setError('Failed to load session.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

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
            await load();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to end session.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }

  async function handleAddPlayer(userId: string) {
    setShowAddPlayer(false);
    setActionLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      await addPlayer(token, sessionId, userId);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to add player.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemovePlayer(userId: string, username: string) {
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
            await removePlayer(token, sessionId, userId);
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

  function openTransaction(type: 'buyin' | 'cashout', player: { userId: string; username: string }) {
    setAmount('');
    setTxModal({ visible: true, type, player });
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
        await addBuyIn(token, sessionId, txModal.player.userId, parsed);
      } else {
        await addCashOut(token, sessionId, txModal.player.userId, parsed);
      }

      setTxModal({ visible: false, type: 'buyin', player: null });
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Transaction failed.');
    } finally {
      setSubmitting(false);
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

  const addablePlayers = groupMembers.filter(
    (m) => !(session.players?.some((p) => p.userId === m.userId) ?? false),
  );

  const balanceMap = new Map<string, PlayerBalanceDto>(
    balances?.players.map((p) => [p.userId, p]) ?? [],
  );

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
          <View style={styles.infoRow}>
            <InfoChip label="Small Blind" value={`₪${session.smallBlind}`} />
            <InfoChip label="Big Blind" value={`₪${session.bigBlind}`} />
          </View>
          {session.startedAt && (
            <Text style={styles.dateText}>
              Started {new Date(session.startedAt).toLocaleString()}
            </Text>
          )}
          {session.endedAt && (
            <Text style={styles.dateText}>
              Ended {new Date(session.endedAt).toLocaleString()}
            </Text>
          )}
        </View>

        {/* Financial summary */}
        {balances && !isDraft && (
          <View style={styles.financeCard}>
            <Text style={styles.financeLabel}>TOTAL POT</Text>
            <Text style={styles.financeAmount}>₪{balances.totalPot.toLocaleString()}</Text>
          </View>
        )}

        {/* Players section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Players ({session.players.length})
          </Text>
          {isDraft && (
            <TouchableOpacity
              style={styles.addPlayerButton}
              onPress={() => setShowAddPlayer(true)}
              disabled={actionLoading || addablePlayers.length === 0}
            >
              <Text style={[styles.addPlayerText, addablePlayers.length === 0 && styles.disabledText]}>
                + Add Player
              </Text>
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
              <React.Fragment key={player.userId}>
                <PlayerRow
                  player={player}
                  canRemove
                  onRemove={() => handleRemovePlayer(player.userId, player.username)}
                />
                {index < session.players.length - 1 && <View style={styles.separator} />}
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={styles.playerList}>
            {session.players.map((player, index) => (
              <React.Fragment key={player.userId}>
                <PlayerBalanceCard
                  player={player}
                  balance={balanceMap.get(player.userId) ?? null}
                  isActive={isActive}
                  onBuyIn={() => openTransaction('buyin', player)}
                  onCashOut={() => openTransaction('cashout', player)}
                />
                {index < session.players.length - 1 && <View style={styles.separator} />}
              </React.Fragment>
            ))}
          </View>
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
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Player</Text>
            {addablePlayers.length === 0 ? (
              <Text style={styles.noPlayersText}>All group members are already in the session.</Text>
            ) : (
              <FlatList
                data={addablePlayers}
                keyExtractor={(m) => m.userId}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.memberPickerRow}
                    onPress={() => handleAddPlayer(item.userId)}
                  >
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>{(item.username?.[0] ?? '?').toUpperCase()}</Text>
                    </View>
                    <Text style={styles.memberPickerName}>{item.username}</Text>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}
          </View>
        </TouchableOpacity>
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
      <Text style={styles.playerName}>{player.username}</Text>
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
  onBuyIn,
  onCashOut,
}: {
  player: SessionPlayerDto;
  balance: PlayerBalanceDto | null;
  isActive: boolean;
  onBuyIn: () => void;
  onCashOut: () => void;
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
          <Text style={styles.playerName}>{player.username}</Text>
          <Text style={styles.balanceSubtext}>
            Invested ₪{totalBuyIn.toLocaleString()}
            {totalCashOut > 0 ? `  ·  Cashed ₪${totalCashOut.toLocaleString()}` : ''}
          </Text>
        </View>
        <ProfitLossBadge amount={profitLoss} hasBuyIn={totalBuyIn > 0} />
      </View>
      {isActive && (
        <View style={styles.balanceActions}>
          <TouchableOpacity style={styles.buyInBtn} onPress={onBuyIn}>
            <Text style={styles.buyInBtnText}>+ Buy In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cashOutBtn} onPress={onCashOut}>
            <Text style={styles.cashOutBtnText}>Cash Out</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function ProfitLossBadge({ amount, hasBuyIn }: { amount: number; hasBuyIn: boolean }) {
  if (!hasBuyIn) return null;
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
    marginBottom: 16,
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

  financeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  financeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  financeAmount: { fontSize: 24, fontWeight: '800', color: colors.gold },

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
  disabledText: { color: colors.textDim },
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
  playerName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
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
  balanceActions: { flexDirection: 'row', gap: 8, paddingLeft: 48 },
  buyInBtn: {
    flex: 1,
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buyInBtnText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  cashOutBtn: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cashOutBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },

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
    maxHeight: '70%',
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
  memberPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 14, fontWeight: '700', color: colors.gold },
  memberPickerName: { fontSize: 15, fontWeight: '600', color: colors.text },
  noPlayersText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', padding: 16 },
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
