import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
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
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import { useAuth } from '../context/AuthContext';
import {
  getMyPendingSettlements,
  markSettlementPaid,
  markAllMySettlementsPaid,
  MyPendingSettlementDto,
} from '../api/settlementsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import { successNotification, errorNotification } from '../utils/haptics';
import { showToast } from '../utils/toast';
import { confirmDialog } from '../utils/confirm';
import { formatMoney } from '../utils/formatters';
import SkeletonCard from '../components/SkeletonCard';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import { PressableScale, MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PendingSettlementsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const [settlements, setSettlements] = useState<MyPendingSettlementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [settleAllLoading, setSettleAllLoading] = useState(false);

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

  // Velvet Table header (replaces the old native navigation header)
  const header = (
    <ScreenHeader
      title="Pending Settlements"
      onBack={() => navigation.goBack()}
      right={
        <PressableScale
          onPress={() => navigation.goBack()}
          hitSlop={8}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneText}>Done</Text>
        </PressableScale>
      }
    />
  );

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

  function handleSettleAll() {
    const myDebts = settlements.filter(s => s.payerUserId === user?.userId);
    if (myDebts.length === 0) return;
    const totalAmount = myDebts.reduce((sum, s) => sum + s.amount, 0);
    confirmDialog(
      'Settle All',
      `Mark all ${myDebts.length} payment${myDebts.length !== 1 ? 's' : ''} (${formatMoney(totalAmount)} total) as paid?`,
      'Settle All',
      async () => {
        setSettleAllLoading(true);
        try {
          const token = await SecureStore.getItemAsync('accessToken');
          if (!token) return;
          const count = await markAllMySettlementsPaid(token);
          successNotification();
          showToast(`${count} settlement${count !== 1 ? 's' : ''} marked as paid`, 'success');
          setSettlements(prev => prev.filter(s => s.payerUserId !== user?.userId));
        } catch {
          errorNotification();
          showToast('Failed to settle all', 'error');
        } finally {
          setSettleAllLoading(false);
        }
      },
    );
  }

  if (loading) {
    return (
      <Screen>
        {header}
        <View style={styles.scroll}>
          <View style={{ padding: spacing.lg, gap: spacing.xl }}>
            <SkeletonCard height={50} borderRadius={radii.md} />
            <SkeletonCard height={100} borderRadius={radii.md} />
            <SkeletonCard height={50} borderRadius={radii.md} />
            <SkeletonCard height={170} borderRadius={radii.md} />
          </View>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <PressableScale
            style={styles.retryBtn}
            onPress={() => load()}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Retry loading settlements"
          >
            <Text style={styles.retryText}>Retry</Text>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  if (settlements.length === 0) {
    return (
      <Screen>
        {header}
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="checkmark-circle-outline" size={iconSize.xl} color={colors.success} />
          </View>
          <Text style={styles.emptyTitle}>All settled up!</Text>
          <Text style={styles.emptySubtitle}>No pending payments across any session.</Text>
        </View>
      </Screen>
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

  const showSettleAll = settlements.some(s => s.payerUserId === user?.userId);

  return (
    <Screen>
    {header}
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.gold} progressBackgroundColor={colors.surface} />}
    >
      {showSettleAll && (
        <MotiView {...slideUpSequence({ reduced })}>
          <PressableScale
            style={styles.settleAllBtn}
            onPress={handleSettleAll}
            disabled={settleAllLoading || !!markingId}
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel="Settle all my debts"
            accessibilityState={{ disabled: settleAllLoading || !!markingId }}
          >
            {settleAllLoading
              ? <ActivityIndicator size="small" color={colors.background} />
              : (
                <>
                  <Ionicons name="checkmark-done-outline" size={iconSize.xs} color={colors.background} />
                  <Text style={styles.settleAllText}>Settle All My Debts</Text>
                </>
              )}
          </PressableScale>
        </MotiView>
      )}

      {Object.entries(bySession).map(([sessionId, group], gi) => (
        <MotiView
          key={sessionId}
          {...slideUpSequence({ reduced, delay: staggerIn(gi + (showSettleAll ? 1 : 0)) })}
          style={styles.sessionGroup}
        >
          <PressableScale
            style={styles.sessionHeader}
            onPress={() => navigation.navigate('Session', { sessionId, groupId: '' })}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={`Open session ${group.sessionName}`}
          >
            <View style={styles.sessionHeaderLeft}>
              <Text style={styles.sessionName} numberOfLines={1}>{group.sessionName}</Text>
              {group.groupName ? <Text style={styles.sessionMeta}>{group.groupName}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={iconSize.xs} color={colors.gold} />
          </PressableScale>

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
                        <Avatar name={s.payerName} size={32} ring={iAmPayer ? 'gold' : undefined} />
                        <Text style={[styles.partyName, iAmPayer && styles.partyNameSelf]} numberOfLines={1}>
                          {iAmPayer ? 'You' : s.payerName}
                        </Text>
                      </View>
                      <View style={styles.flowCenter}>
                        <Ionicons name="arrow-forward" size={iconSize.xs} color={colors.textDim} />
                        <Text style={styles.flowAmount}>{formatMoney(s.amount)}</Text>
                      </View>
                      <View style={styles.party}>
                        <Avatar name={s.receiverName} size={32} ring={!iAmPayer ? 'gold' : undefined} />
                        <Text style={[styles.partyName, !iAmPayer && styles.partyNameSelf]} numberOfLines={1}>
                          {iAmPayer ? s.receiverName : 'You'}
                        </Text>
                      </View>
                    </View>

                    {iAmPayer ? (
                      <PressableScale
                        style={styles.markPaidBtn}
                        onPress={() => handleMarkPaid(s.id)}
                        disabled={markingId === s.id}
                        haptic="medium"
                        accessibilityRole="button"
                        accessibilityLabel={`Mark ${formatMoney(s.amount)} to ${s.receiverName} as paid`}
                        accessibilityState={{ disabled: markingId === s.id }}
                      >
                        {markingId === s.id
                          ? <ActivityIndicator size="small" color={colors.background} />
                          : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={iconSize.xs} color={colors.background} />
                              <Text style={styles.markPaidText}>Mark Paid</Text>
                            </>
                          )}
                      </PressableScale>
                    ) : (
                      <View style={styles.awaitingBadge}>
                        <Text style={styles.awaitingText}>Awaiting payment</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </MotiView>
      ))}

      <View style={{ height: spacing.huge }} />
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.lg },
  doneText: { color: colors.gold, fontSize: 16, fontWeight: '600' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
    gap: spacing.md,
  },
  errorText: { color: colors.error, fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, minHeight: 44, justifyContent: 'center', borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border },
  retryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: radii.xl,
    backgroundColor: colors.successFaint,
    borderWidth: 1,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  settleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    marginBottom: spacing.xl,
    ...shadows.goldSm,
  },
  settleAllText: { fontSize: 15, fontWeight: '700', color: colors.background },

  sessionGroup: {
    marginBottom: spacing.xl,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
    gap: spacing.sm,
  },
  sessionHeaderLeft: { flex: 1, gap: 2 },
  sessionName: { ...typography.label, color: colors.text },
  sessionMeta: { fontSize: 12, color: colors.textMuted },

  settlementList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    overflow: 'hidden',
  },
  settlementRow: {
    flexDirection: 'row',
  },
  settlementRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  accent: { width: 4 },
  accentPay: { backgroundColor: colors.error },
  accentReceive: { backgroundColor: colors.success },
  settlementContent: { flex: 1, padding: spacing.md, gap: spacing.sm },

  settlementFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  party: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  partyName: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  partyNameSelf: { color: colors.gold },
  flowCenter: { alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm },
  flowAmount: { ...typography.amount, color: colors.gold },

  markPaidBtn: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gold,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
    ...shadows.goldSm,
  },
  markPaidText: { fontSize: 13, fontWeight: '700', color: colors.background },
  awaitingBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  awaitingText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
});
