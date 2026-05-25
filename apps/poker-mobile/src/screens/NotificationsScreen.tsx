import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { getMyNotifications, markAllNotificationsRead, NotificationDto } from '../api/notificationsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import SkeletonCard from '../components/SkeletonCard';
import SkeletonRow from '../components/SkeletonRow';
import { timeAgo } from '../utils/formatters';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPE_ICON: Record<string, { name: string; color: string }> = {
  SessionEnded:        { name: 'flag-outline',    color: colors.gold },
  SettlementCreated:   { name: 'cash-outline',    color: colors.warning },
  SettlementPaid:      { name: 'checkmark-circle-outline', color: colors.success },
  GroupInviteReceived: { name: 'mail-outline',    color: colors.gold },
  AchievementUnlocked: { name: 'trophy-outline',  color: colors.gold },
  GroupJoined:         { name: 'people-outline',  color: colors.success },
  MemberRemoved:       { name: 'person-remove-outline', color: colors.error },
};

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const data = await getMyNotifications(token);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await markAllNotificationsRead(token);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  }, []);

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <SkeletonCard height={24} borderRadius={6} style={{ width: 160 }} />
        </View>
        <View style={styles.listCard}>
          <SkeletonRow isFirst />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} progressBackgroundColor={colors.surface} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="notifications-outline" size={36} color={colors.textDim} />
          </View>
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptySub}>New notifications will appear here after sessions, settlements, and achievements.</Text>
        </View>
      ) : (
        <View style={styles.listCard}>
          {notifications.map((n, i) => {
            const iconInfo = TYPE_ICON[n.type] ?? { name: 'notifications-outline', color: colors.textMuted };
            return (
              <View key={n.id} style={[styles.row, i === 0 && styles.rowFirst, !n.isRead && styles.rowUnread]}>
                <View style={[styles.iconWrap, { backgroundColor: iconInfo.color + '18' }]}>
                  <Ionicons name={iconInfo.name as any} size={18} color={iconInfo.color} />
                </View>
                <View style={styles.rowContent}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowTitle, !n.isRead && styles.rowTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {!n.isRead && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.rowBody} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.rowTime}>{timeAgo(n.createdAt)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    ...typography.h2,
    color: colors.text,
  },
  markAllText: {
    ...typography.caption,
    color: colors.gold,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  rowUnread: {
    backgroundColor: colors.surfaceHigh,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowContent: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.textHigh,
  },
  rowTitleUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  rowBody: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  rowTime: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textHigh,
  },
  emptySub: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});
