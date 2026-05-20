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
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import {
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
  PendingInvitationDto,
} from '../api/groupsApi';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Invitations'>;

function formatExpiry(expiresAt: string): string {
  const days = Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

export default function InvitationsScreen({ navigation }: Props) {
  const [invitations, setInvitations] = useState<PendingInvitationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const data = await getMyInvitations(token);
      setInvitations(data);
    } catch {
      setError('Failed to load invitations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleAccept = async (inv: PendingInvitationDto) => {
    try {
      setActionLoading(inv.invitationId);
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await acceptInvitation(token, inv.invitationId);
      navigation.navigate('GroupDetail', { groupId: inv.groupId, groupName: inv.groupName });
    } catch {
      Alert.alert('Error', 'Failed to accept invitation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = (inv: PendingInvitationDto) => {
    Alert.alert(
      'Decline Invitation',
      `Decline the invitation to ${inv.groupName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(inv.invitationId);
              const token = await SecureStore.getItemAsync('accessToken');
              if (!token) return;
              await declineInvitation(token, inv.invitationId);
              await load();
            } catch {
              Alert.alert('Error', 'Failed to decline invitation.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
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
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            setLoading(true);
            load();
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={invitations}
      keyExtractor={(item) => item.invitationId}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✉</Text>
          <Text style={styles.emptyTitle}>No pending invitations</Text>
          <Text style={styles.emptySubtitle}>
            When someone invites you to a group, it will appear here.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const isActing = actionLoading === item.invitationId;
        return (
          <View style={styles.card}>
            <Text style={styles.groupName}>{item.groupName}</Text>
            <Text style={styles.invitedBy}>Invited by {item.invitedByUsername}</Text>
            <Text style={styles.expiry}>{formatExpiry(item.expiresAt)}</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.acceptBtn, (!!actionLoading) && styles.btnDisabled]}
                onPress={() => handleAccept(item)}
                disabled={!!actionLoading}
              >
                {isActing ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.acceptBtnText}>Accept</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.declineBtn, (!!actionLoading) && styles.btnDisabled]}
                onPress={() => handleDecline(item)}
                disabled={!!actionLoading}
              >
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 40, color: colors.textMuted },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  groupName: { fontSize: 17, fontWeight: '700', color: colors.gold },
  invitedBy: { fontSize: 13, color: colors.textMuted },
  expiry: { fontSize: 12, color: colors.textDim },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  acceptBtnText: { color: colors.background, fontSize: 14, fontWeight: '700' },
  declineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  declineBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
});
