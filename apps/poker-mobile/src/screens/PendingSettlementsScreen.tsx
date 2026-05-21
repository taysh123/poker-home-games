import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { useAuth } from '../context/AuthContext';
import {
  getMyPendingSettlements,
  markSettlementPaid,
  MyPendingSettlementDto,
} from '../api/settlementsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import { successNotification, errorNotification } from '../utils/haptics';
import { showToast } from '../utils/toast';
import { formatMoney } from '../utils/formatters';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PendingSettlementsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [settlements, setSettlements] = useState<MyPendingSettlementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const data = await getMyPendingSettlements(token);
      setSettlements(data);
    } catch {
      setError('Failed to load settlements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 4 }}>
          <Text style={{ color: colors.gold, fontSize: 16, fontWeight: '600' }}>Done</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  async function handleMarkPaid(id: string) {
    setMarkingId(id);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await markSettlementPaid(token, id);
      successNotification();
      showToast('Marked as paid', 'success');
      setSettlements(prev => prev.filter(s => s.id !== id));
    } catch {
      errorNotification();
      showToast('Failed to mark as paid', 'error');
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

  if (settlements.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="checkmark-circle-outline" size={40} color={colors.success} />
        </View>
        <Text style={styles.emptyTitle}>All settled up!</Text>
        <Text style={styles.emptySubtitle}>No pending payments across any session.</Text>
      </View>
    );
  }

  // Group by session
  const bySession = settlements.reduce<Record<string, { sessionName: string; groupName: string; items: MyPendingSettlementDto[] }>>(
    (acc, s) => {
      if (!acc[s.sessionId]) {
        acc[s.sessionId] = { sessionName: s.sessionName, groupName: s.groupName, items: [] };
      }
      acc[s.sessionId].items.push(s);
      return acc;
    },
    {},
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.gold} />}
    >
      {Object.entries(bySession).map(([sessionId, group]) => (
        <View key={sessionId} style={styles.sessionGroup}>
          <TouchableOpacity
            style={styles.sessionHeader}
            onPress={() => navigation.navigate('Session', { sessionId, groupId: '' })}
            activeOpacity={0.7}
          >
            <View style={styles.sessionHeaderLeft}>
              <Text style={styles.sessionName} numberOfLines={1}>{group.sessionName}</Text>
              {group.groupName && <Text style={styles.sessionMeta}>{group.groupName}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.gold} />
          </TouchableOpacity>

          <View style={styles.settlementList}>
            {group.items.map((s, i) => {
              const iAmPayer = s.payerUserId === user?.userId;
              return (
                <View key={s.id} style={[styles.settlementRow, i > 0 && styles.settlementRowBorder]}>
                  {/* Left accent */}
                  <View style={[styles.accent, iAmPayer ? styles.accentPay : styles.accentReceive]} />

                  <View style={styles.settlementContent}>
                    <View style={styles.settlementFlow}>
                      <View style={styles.party}>
                        <View style={[styles.partyAvatar, iAmPayer && styles.partyAvatarSelf]}>
                          <Text style={styles.partyAvatarText}>{s.payerName[0]?.toUpperCase() ?? '?'}</Text>
                        </View>
                        <Text style={[styles.partyName, iAmPayer && styles.partyNameSelf]} numberOfLines={1}>
                          {iAmPayer ? 'You' : s.payerName}
                        </Text>
                      </View>
                      <View style={styles.flowCenter}>
                        <Ionicons name="arrow-forward" size={14} color={colors.textDim} />
                        <Text style={styles.flowAmount}>{formatMoney(s.amount)}</Text>
                      </View>
                      <View style={styles.party}>
                        <View style={[styles.partyAvatar, !iAmPayer && styles.partyAvatarSelf]}>
                          <Text style={styles.partyAvatarText}>{s.receiverName[0]?.toUpperCase() ?? '?'}</Text>
                        </View>
                        <Text style={[styles.partyName, !iAmPayer && styles.partyNameSelf]} numberOfLines={1}>
                          {iAmPayer ? s.receiverName : 'You'}
                        </Text>
                      </View>
                    </View>

                    {iAmPayer && (
                      <TouchableOpacity
                        style={styles.markPaidBtn}
                        onPress={() => handleMarkPaid(s.id)}
                        disabled={markingId === s.id}
                        activeOpacity={0.8}
                      >
                        {markingId === s.id
                          ? <ActivityIndicator size="small" color={colors.background} />
                          : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={14} color={colors.background} />
                              <Text style={styles.markPaidText}>Mark Paid</Text>
                            </>
                          )}
                      </TouchableOpacity>
                    )}
                    {!iAmPayer && (
                      <View style={styles.awaitingBadge}>
                        <Text style={styles.awaitingText}>Awaiting payment</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
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
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: 'rgba(39,174,96,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(39,174,96,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  sessionGroup: {
    marginBottom: 20,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  sessionHeaderLeft: { flex: 1, gap: 2 },
  sessionName: { ...typography.label, color: colors.text },
  sessionMeta: { fontSize: 12, color: colors.textMuted },
  sessionChevron: { fontSize: 20, color: colors.gold, fontWeight: '300' },

  settlementList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
  },
  settlementRow: {
    flexDirection: 'row',
  },
  settlementRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  accent: { width: 4 },
  accentPay: { backgroundColor: colors.error },
  accentReceive: { backgroundColor: colors.success },
  settlementContent: { flex: 1, padding: 14, gap: 10 },

  settlementFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  party: { alignItems: 'center', gap: 4, flex: 1 },
  partyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyAvatarSelf: { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: colors.gold },
  partyAvatarText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  partyName: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  partyNameSelf: { color: colors.gold },
  flowCenter: { alignItems: 'center', gap: 2, paddingHorizontal: 8 },
  flowArrow: { fontSize: 16, color: colors.textDim },
  flowAmount: { ...typography.amount, color: colors.gold },

  markPaidBtn: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...shadows.goldSm,
  },
  markPaidText: { fontSize: 13, fontWeight: '700', color: colors.background },
  awaitingBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  awaitingText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
});
