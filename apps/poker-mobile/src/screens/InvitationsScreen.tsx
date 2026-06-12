import React, { useCallback, useState } from 'react';
import {
  Animated,
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
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import {
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
  PendingInvitationDto,
} from '../api/groupsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useScreenEntrance } from '../hooks/useScreenEntrance';
import SkeletonCard from '../components/SkeletonCard';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';

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
  const entrance = useScreenEntrance();

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

  // Velvet Table header (replaces the old native navigation header)
  const header = (
    <ScreenHeader title="Invitations" onBack={() => navigation.goBack()} />
  );

  if (loading) {
    return (
      <Screen>
        {header}
        <View style={styles.list}>
          <View style={{ padding: 16, gap: 12 }}>
            <SkeletonCard height={140} borderRadius={16} />
            <SkeletonCard height={140} borderRadius={16} />
            <SkeletonCard height={140} borderRadius={16} />
          </View>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        {header}
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
      </Screen>
    );
  }

  return (
    <Screen>
    {header}
    <Animated.View style={[{ flex: 1 }, entrance.style]}>
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={invitations}
      keyExtractor={(item) => item.invitationId}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} progressBackgroundColor={colors.surface} />
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="mail-outline" size={36} color={colors.textDim} />
          </View>
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
            <View style={styles.cardHeader}>
              <View style={styles.groupAvatar}>
                <Text style={styles.groupAvatarText}>{item.groupName[0]?.toUpperCase() ?? '?'}</Text>
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.groupName} numberOfLines={1}>{item.groupName}</Text>
                <Text style={styles.invitedBy}>Invited by {item.invitedByUsername}</Text>
              </View>
            </View>
            <View style={styles.expiryRow}>
              <Ionicons name="time-outline" size={12} color={colors.textDim} />
              <Text style={styles.expiry}>{formatExpiry(item.expiresAt)}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.acceptBtn, (!!actionLoading) && styles.btnDisabled]}
                onPress={() => handleAccept(item)}
                disabled={!!actionLoading}
                activeOpacity={0.8}
              >
                {isActing ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.background} />
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.declineBtn, (!!actionLoading) && styles.btnDisabled]}
                onPress={() => handleDecline(item)}
                disabled={!!actionLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle-outline" size={16} color={colors.textMuted} />
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
    </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
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
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 10,
    ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarText: { fontSize: 18, fontWeight: '800', color: colors.gold },
  cardHeaderText: { flex: 1, gap: 3 },
  groupName: { fontSize: 16, fontWeight: '700', color: colors.text },
  invitedBy: { fontSize: 12, color: colors.textMuted },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  expiry: { fontSize: 12, color: colors.textDim },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.gold,
    borderRadius: 11,
    paddingVertical: 12,
    ...shadows.goldSm,
  },
  acceptBtnText: { color: colors.background, fontSize: 14, fontWeight: '700' },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    paddingVertical: 12,
  },
  declineBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
});
