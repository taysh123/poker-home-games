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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import {
  getMyBalances,
  markDebtPaid,
  BalanceEntryDto,
  BalanceItemDto,
} from '../api/debtsApi';
import { markSettlementPaid } from '../api/settlementsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import { successNotification, errorNotification } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Balances'>;

export default function BalancesScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<BalanceEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const data = await getMyBalances(token);
      setEntries(data);
    } catch {
      setError('Failed to load balances.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  function toggleExpand(userId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  async function handleMarkPaid(item: BalanceItemDto) {
    setMarkingId(item.itemId);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      if (item.type === 'Session') {
        await markSettlementPaid(token, item.itemId);
      } else {
        await markDebtPaid(token, item.itemId);
      }
      successNotification();
      await load(true);
    } catch (err: any) {
      errorNotification();
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to mark as paid.');
    } finally {
      setMarkingId(null);
    }
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
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalOwedToMe = entries.filter(e => e.netBalance > 0).reduce((s, e) => s + e.netBalance, 0);
  const totalIOwe     = entries.filter(e => e.netBalance < 0).reduce((s, e) => s + Math.abs(e.netBalance), 0);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      {/* Summary bar */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: colors.success }]}>
          <Text style={styles.summaryLabel}>OWED TO YOU</Text>
          <Text style={[styles.summaryAmount, { color: colors.success }]}>
            +₪{Math.round(totalOwedToMe).toLocaleString()}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: colors.error }]}>
          <Text style={styles.summaryLabel}>YOU OWE</Text>
          <Text style={[styles.summaryAmount, { color: colors.error }]}>
            -₪{Math.round(totalIOwe).toLocaleString()}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.recordDebtBtn}
        onPress={() => navigation.navigate('CreateDebt', {})}
        activeOpacity={0.8}
      >
        <Text style={styles.recordDebtText}>+ Record Debt</Text>
      </TouchableOpacity>

      {entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>All settled up</Text>
          <Text style={styles.emptySubtitle}>No pending debts or settlements</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>PENDING BALANCES</Text>
          {entries.map(entry => {
            const isExpanded = expanded.has(entry.userId);
            const netAbs = Math.abs(entry.netBalance);
            const theyOweMe = entry.netBalance > 0;
            const netColor = theyOweMe ? colors.success : entry.netBalance < 0 ? colors.error : colors.textMuted;
            const netPrefix = theyOweMe ? '+' : entry.netBalance < 0 ? '-' : '';

            return (
              <View key={entry.userId} style={styles.entryCard}>
                <TouchableOpacity
                  style={styles.entryHeader}
                  onPress={() => toggleExpand(entry.userId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.entryLeft}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(entry.username[0] ?? '?').toUpperCase()}</Text>
                    </View>
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryUsername}>{entry.username}</Text>
                      <Text style={styles.entryMeta}>
                        {entry.items.length} item{entry.items.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.entryRight}>
                    <Text style={[styles.entryNet, { color: netColor }]}>
                      {netPrefix}₪{Math.round(netAbs).toLocaleString()}
                    </Text>
                    <Text style={[styles.chevron, isExpanded && styles.chevronOpen]}>›</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.itemsList}>
                    {entry.items.map((item, i) => (
                      <React.Fragment key={item.itemId}>
                        {i > 0 && <View style={styles.itemDivider} />}
                        <View style={styles.itemRow}>
                          <View style={styles.itemLeft}>
                            <View style={[styles.typeBadge, item.type === 'Session' ? styles.typeBadgeSession : styles.typeBadgeDebt]}>
                              <Text style={styles.typeBadgeText}>{item.type === 'Session' ? 'SESSION' : 'DEBT'}</Text>
                            </View>
                            <View style={styles.itemTextCol}>
                              <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
                              <Text style={[styles.itemDirection, item.youOwe ? { color: colors.error } : { color: colors.success }]}>
                                {item.youOwe ? 'You owe' : 'They owe'} ₪{item.amount.toLocaleString()}
                              </Text>
                            </View>
                          </View>
                          {item.youOwe ? (
                            <TouchableOpacity
                              style={styles.paidBtn}
                              onPress={() => handleMarkPaid(item)}
                              disabled={markingId !== null}
                            >
                              {markingId === item.itemId
                                ? <ActivityIndicator size="small" color={colors.success} />
                                : <Text style={styles.paidBtnText}>Mark Paid</Text>}
                            </TouchableOpacity>
                          ) : item.type === 'Session' ? (
                            <TouchableOpacity
                              style={styles.viewBtn}
                              onPress={() => navigation.navigate('SessionSummary', {
                                sessionId: item.sessionId!,
                                sessionName: item.description,
                              })}
                            >
                              <Text style={styles.viewBtnText}>View</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </React.Fragment>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorText: { color: colors.error, fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  retryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryAmount: { fontSize: 22, fontWeight: '800' },

  recordDebtBtn: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  recordDebtText: { fontSize: 14, fontWeight: '700', color: colors.gold },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  entryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  entryLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: colors.gold },
  entryInfo: { flex: 1, gap: 2 },
  entryUsername: { fontSize: 15, fontWeight: '600', color: colors.text },
  entryMeta: { fontSize: 11, color: colors.textMuted },
  entryRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryNet: { fontSize: 16, fontWeight: '700' },
  chevron: { fontSize: 20, color: colors.textDim, transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '90deg' }] },

  itemsList: { borderTopWidth: 1, borderTopColor: colors.border },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  itemDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, borderWidth: 1 },
  typeBadgeSession: { backgroundColor: 'rgba(201,168,76,0.1)', borderColor: 'rgba(201,168,76,0.4)' },
  typeBadgeDebt: { backgroundColor: 'rgba(58,74,90,0.5)', borderColor: colors.border },
  typeBadgeText: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  itemTextCol: { flex: 1, gap: 2 },
  itemDesc: { fontSize: 13, fontWeight: '600', color: colors.text },
  itemDirection: { fontSize: 11 },

  paidBtn: {
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 76,
    alignItems: 'center',
    backgroundColor: 'rgba(39,174,96,0.08)',
  },
  paidBtnText: { fontSize: 11, fontWeight: '700', color: colors.success },
  viewBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  viewBtnText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },

  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  emptyIcon: { fontSize: 40, color: colors.success, marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
