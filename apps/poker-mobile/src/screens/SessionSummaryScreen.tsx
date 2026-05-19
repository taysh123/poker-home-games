import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getSessionById, getSessionBalances, SessionDetailDto, SessionBalancesDto } from '../api/sessionsApi';
import { getSessionSettlements, calculateSettlements, markSettlementPaid, SessionSettlementsDto } from '../api/settlementsApi';
import { getSessionHandHistory, HandRecordDto } from '../api/handsApi';
import { useAuth } from '../context/AuthContext';
import { exportSessionCsv } from '../utils/exportUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionSummary'>;

type SummaryData = {
  session: SessionDetailDto;
  balances: SessionBalancesDto;
  settlements: SessionSettlementsDto;
  hands: HandRecordDto[];
};

function formatDuration(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null;
  const mins = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
  );
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function rankLabel(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

export default function SessionSummaryScreen({ route, navigation }: Props) {
  const { sessionId, sessionName } = route.params;
  const { user } = useAuth();

  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const [session, balances, settlementsRaw, handsData] = await Promise.all([
        getSessionById(token, sessionId),
        getSessionBalances(token, sessionId),
        getSessionSettlements(token, sessionId),
        getSessionHandHistory(token, sessionId).catch(() => [] as HandRecordDto[]),
      ]);

      let settlements = settlementsRaw;
      if (settlementsRaw.settlements.length === 0 && session.status === 'Finished') {
        try {
          const calculated = await calculateSettlements(token, sessionId);
          settlements = { sessionId, totalPot: balances.totalPot, settlements: calculated };
        } catch {
          // silently ignore — user can still tap Calculate manually on SettlementScreen
        }
      }

      setData({ session, balances, settlements, hands: handsData });
    } catch {
      setError('Failed to load session summary.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  async function handleExport() {
    setExporting(true);
    try {
      await exportSessionCsv(sessionId, sessionName);
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message ?? 'Could not export session.');
    } finally {
      setExporting(false);
    }
  }

  async function handleMarkPaid(settlementId: string) {
    setMarkingPaidId(settlementId);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await markSettlementPaid(token, settlementId);
      setLoading(true);
      load();
    } catch {
      Alert.alert('Error', 'Failed to mark settlement as paid.');
    } finally {
      setMarkingPaidId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { session, balances, settlements, hands } = data;
  const sortedPlayers = [...balances.players].sort((a, b) => b.profitLoss - a.profitLoss);
  const hasSettlements = settlements.settlements.length > 0;
  const duration = formatDuration(session.startedAt, session.endedAt);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />
      }
    >
      {/* ── Session info card ── */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <Text style={styles.sessionName} numberOfLines={1}>♠  {session.name}</Text>
          <View style={styles.infoCardHeaderRight}>
            <View style={styles.finishedBadge}>
              <Text style={styles.finishedBadgeText}>FINISHED</Text>
            </View>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={handleExport}
              disabled={exporting}
            >
              {exporting
                ? <ActivityIndicator size="small" color={colors.gold} />
                : <Text style={styles.exportBtnText}>Export</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatDate(session.createdAt)}</Text>
          {duration && <Text style={styles.metaDot}>·</Text>}
          {duration && <Text style={styles.metaText}>{duration}</Text>}
        </View>

        <View style={styles.blindsRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>SB ₪{session.smallBlind}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>BB ₪{session.bigBlind}</Text>
          </View>
        </View>

        <Text style={styles.potLabel}>TOTAL POT</Text>
        <Text style={styles.potAmount}>₪{balances.totalPot.toLocaleString()}</Text>
      </View>

      {/* ── Player results ── */}
      <Text style={styles.sectionTitle}>PLAYER RESULTS</Text>
      <View style={styles.resultsCard}>
        {sortedPlayers.map((player, index) => {
          const isWinner = player.profitLoss > 0;
          const isLoser  = player.profitLoss < 0;
          const profitColor = isWinner ? colors.success : isLoser ? colors.error : colors.textMuted;
          return (
            <React.Fragment key={player.sessionPlayerId}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.playerRow}>
                <View style={styles.playerLeft}>
                  <Text style={[styles.rank, index === 0 && styles.rankFirst]}>
                    {rankLabel(index + 1)}
                  </Text>
                  <View>
                    <Text style={styles.playerName}>{player.username}</Text>
                    <Text style={styles.playerSub}>
                      Invested ₪{player.totalBuyIn.toLocaleString()}
                      {player.totalCashOut > 0
                        ? `  ·  Cashed ₪${player.totalCashOut.toLocaleString()}`
                        : ''}
                    </Text>
                  </View>
                </View>
                <View style={[styles.profitBadge, { borderColor: profitColor }]}>
                  <Text style={[styles.profitText, { color: profitColor }]}>
                    {isWinner ? '+' : ''}₪{Math.abs(player.profitLoss).toLocaleString()}
                  </Text>
                </View>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {/* ── Notes ── */}
      {session.notes ? (
        <>
          <Text style={styles.sectionTitle}>NOTES</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>{session.notes}</Text>
          </View>
        </>
      ) : null}

      {/* ── Hand History ── */}
      {hands.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>HAND HISTORY ({hands.length})</Text>
          <View style={styles.resultsCard}>
            {hands.map((hand, index) => (
              <React.Fragment key={hand.id}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.handRow}>
                  <Text style={styles.handPot}>₪{hand.potAmount.toLocaleString()}</Text>
                  <Text style={styles.handArrow}> → </Text>
                  <Text style={styles.handWinner}>{hand.winnerName}</Text>
                  {hand.note ? (
                    <Text style={styles.handNote} numberOfLines={1}>  "{hand.note}"</Text>
                  ) : null}
                </View>
              </React.Fragment>
            ))}
          </View>
        </>
      )}

      {/* ── Settlements ── */}
      <Text style={styles.sectionTitle}>SETTLEMENTS</Text>
      {hasSettlements ? (
        <>
          <View style={styles.settlementsCard}>
            {settlements.settlements.map((s, index) => {
              const isPaid = s.status === 'Confirmed';
              const isInvolved = user?.userId === s.payerUserId || user?.userId === s.receiverUserId;
              const isMarking = markingPaidId === s.id;
              return (
                <React.Fragment key={s.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.settlementRow}>
                    <View style={styles.settlementLeft}>
                      <Text style={styles.settlementNames}>
                        <Text style={styles.settlementPayer}>{s.payerName}</Text>
                        <Text style={styles.settlementArrow}> → </Text>
                        <Text style={styles.settlementReceiver}>{s.receiverName}</Text>
                      </Text>
                      <Text style={styles.settlementAmount}>₪{s.amount.toFixed(2)}</Text>
                    </View>
                    {!isPaid && isInvolved ? (
                      <TouchableOpacity
                        style={styles.markPaidBtn}
                        onPress={() => handleMarkPaid(s.id)}
                        disabled={markingPaidId !== null}
                      >
                        {isMarking
                          ? <ActivityIndicator size="small" color={colors.success} />
                          : <Text style={styles.markPaidText}>Mark Paid</Text>
                        }
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.statusBadge, isPaid ? styles.badgePaid : styles.badgePending]}>
                        <Text style={[styles.statusText, isPaid ? styles.statusPaid : styles.statusPending]}>
                          {isPaid ? 'PAID' : 'PENDING'}
                        </Text>
                      </View>
                    )}
                  </View>
                </React.Fragment>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => navigation.navigate('Settlement', { sessionId, sessionName })}
          >
            <Text style={styles.manageBtnText}>Manage Settlements</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.noSettlementsCard}>
          <Text style={styles.noSettlementsText}>Settlements not calculated yet.</Text>
          <TouchableOpacity
            style={styles.calculateBtn}
            onPress={() => navigation.navigate('Settlement', { sessionId, sessionName })}
          >
            <Text style={styles.calculateBtnText}>Calculate Settlements</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  errorText: { color: colors.error, fontSize: 15, marginBottom: 16, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { color: colors.text, fontSize: 14, fontWeight: '600' },

  // Info card
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  infoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sessionName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.gold,
  },
  infoCardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gold,
    minWidth: 52,
    alignItems: 'center',
  },
  exportBtnText: { fontSize: 11, fontWeight: '700', color: colors.gold },
  finishedBadge: {
    backgroundColor: 'rgba(122,138,153,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  finishedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  metaText: { fontSize: 13, color: colors.textMuted },
  metaDot: { fontSize: 13, color: colors.textDim },

  blindsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  potLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  potAmount: { fontSize: 34, fontWeight: '700', color: colors.text },

  // Section header
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // Results card
  resultsCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  playerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { fontSize: 13, fontWeight: '700', color: colors.textMuted, minWidth: 28 },
  rankFirst: { color: colors.gold },
  playerName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  playerSub: { fontSize: 12, color: colors.textMuted },
  profitBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  profitText: { fontSize: 14, fontWeight: '700' },

  // Settlements card
  settlementsCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  settlementLeft: { flex: 1, gap: 4 },
  settlementNames: { fontSize: 14 },
  settlementPayer: { color: colors.text, fontWeight: '600' },
  settlementArrow: { color: colors.gold, fontWeight: '700' },
  settlementReceiver: { color: colors.text, fontWeight: '600' },
  settlementAmount: { fontSize: 16, fontWeight: '700', color: colors.goldLight },

  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  badgePending: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderColor: colors.gold,
  },
  badgePaid: {
    backgroundColor: 'rgba(39,174,96,0.12)',
    borderColor: colors.success,
  },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  statusPending: { color: colors.gold },
  statusPaid: { color: colors.success },

  markPaidBtn: {
    backgroundColor: 'rgba(39,174,96,0.10)',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  markPaidText: { fontSize: 12, fontWeight: '700', color: colors.success },

  // Manage button
  manageBtn: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  manageBtnText: { color: colors.gold, fontSize: 14, fontWeight: '700' },

  // Notes
  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  notesText: { fontSize: 14, color: colors.text, lineHeight: 20 },

  // Hand history
  handRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexWrap: 'wrap',
  },
  handPot: { fontSize: 14, fontWeight: '700', color: colors.gold },
  handArrow: { fontSize: 14, color: colors.gold, fontWeight: '700' },
  handWinner: { fontSize: 14, fontWeight: '600', color: colors.text },
  handNote: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', flex: 1 },

  // No settlements state
  noSettlementsCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  noSettlementsText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  calculateBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  calculateBtnText: { color: colors.background, fontSize: 14, fontWeight: '700' },
});
