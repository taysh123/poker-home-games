import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme/colors';
import {
  calculateSettlements,
  getSessionSettlements,
  markSettlementPaid,
  SettlementDto,
  SessionSettlementsDto,
} from '../api/settlementsApi';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Settlement'>;

export default function SettlementScreen({ route }: Props) {
  const { sessionId, sessionName } = route.params;
  const { user } = useAuth();

  const [data, setData] = useState<SessionSettlementsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const result = await getSessionSettlements(token, sessionId);
      setData(result);
    } catch {
      setError('Failed to load settlements.');
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

  const handleCalculate = async () => {
    try {
      setActionLoading(true);
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await calculateSettlements(token, sessionId);
      await load();
    } catch {
      Alert.alert('Error', 'Failed to calculate settlements.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async (settlementId: string) => {
    try {
      setActionLoading(true);
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await markSettlementPaid(token, settlementId);
      await load();
    } catch {
      Alert.alert('Error', 'Failed to mark settlement as paid.');
    } finally {
      setActionLoading(false);
    }
  };

  const isInvolved = (s: SettlementDto) =>
    user?.userId === s.payerUserId || user?.userId === s.receiverUserId;

  const renderSettlement = ({ item }: { item: SettlementDto }) => {
    const isPaid = item.status === 'Confirmed';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.transferRow}>
            <Text style={styles.playerName}>{item.payerName}</Text>
            <Text style={styles.arrow}> → </Text>
            <Text style={styles.playerName}>{item.receiverName}</Text>
          </View>
          <View style={[styles.badge, isPaid ? styles.badgePaid : styles.badgePending]}>
            <Text style={[styles.badgeText, isPaid ? styles.badgeTextPaid : styles.badgeTextPending]}>
              {isPaid ? 'PAID' : 'PENDING'}
            </Text>
          </View>
        </View>

        <Text style={styles.amount}>₪{item.amount.toFixed(2)}</Text>

        {!isPaid && isInvolved(item) && (
          <TouchableOpacity
            style={[styles.paidBtn, actionLoading && styles.btnDisabled]}
            onPress={() => handleMarkPaid(item.id)}
            disabled={actionLoading}
          >
            <Text style={styles.paidBtnText}>Mark as Paid</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasSettlements = (data?.settlements.length ?? 0) > 0;

  return (
    <View style={styles.container}>
      {/* Header summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>♠  {sessionName}</Text>
        <Text style={styles.summaryLabel}>Total Pot</Text>
        <Text style={styles.summaryPot}>${data?.totalPot.toFixed(2) ?? '0.00'}</Text>
      </View>

      {/* Calculate / Recalculate button */}
      <TouchableOpacity
        style={[styles.calcBtn, actionLoading && styles.btnDisabled]}
        onPress={handleCalculate}
        disabled={actionLoading}
      >
        {actionLoading
          ? <ActivityIndicator size="small" color={colors.background} />
          : <Text style={styles.calcBtnText}>
              {hasSettlements ? 'Recalculate Settlements' : 'Calculate Settlements'}
            </Text>
        }
      </TouchableOpacity>

      {hasSettlements ? (
        <FlatList
          data={data!.settlements}
          keyExtractor={(item) => item.id}
          renderItem={renderSettlement}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.gold} />
          }
          ListHeaderComponent={
            <Text style={styles.sectionHeader}>Payment Instructions</Text>
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No settlements yet.</Text>
          <Text style={styles.emptySubText}>Tap "Calculate Settlements" to generate payment instructions.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    margin: 16,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  summaryTitle: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryPot: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    marginTop: 4,
  },
  calcBtn: {
    backgroundColor: colors.gold,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  calcBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  list: {
    paddingBottom: 32,
    paddingTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  playerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  arrow: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '700',
  },
  amount: {
    color: colors.goldLight,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  badgePending: {
    backgroundColor: 'rgba(201, 168, 76, 0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  badgePaid: {
    backgroundColor: 'rgba(39, 174, 96, 0.15)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeTextPending: {
    color: colors.gold,
  },
  badgeTextPaid: {
    color: colors.success,
  },
  paidBtn: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
  },
  paidBtnText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
