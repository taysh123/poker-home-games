import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { getGroupSessions, SessionSummaryDto } from '../api/sessionsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import SkeletonCard from '../components/SkeletonCard';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionsList'>;

export default function SessionsListScreen({ route, navigation }: Props) {
  const { groupId, groupName, userRole } = route.params;

  const [sessions, setSessions] = useState<SessionSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Sessions',
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
      headerShadowVisible: false,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('NewGame', { groupId, groupName })}
          style={styles.headerAddBtn}
          hitSlop={8}
        >
          <Ionicons name="add" size={22} color={colors.gold} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, groupId, groupName]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const data = await getGroupSessions(token, groupId);
      setSessions(data);
    } catch {
      setError('Failed to load sessions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  useFocusEffect(useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(16);
    load().then(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 10, tension: 100, useNativeDriver: true }),
      ]).start();
    });
  }, [load]));

  if (loading) {
    return (
      <View style={styles.listWrap}>
        <View style={[styles.listContent, { gap: 10 }]}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardAccent} />
              <View style={styles.cardInner}>
                <SkeletonCard height={16} borderRadius={6} style={{ width: '60%', marginBottom: 10 }} />
                <SkeletonCard height={11} borderRadius={4} style={{ width: '40%' }} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => load()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="layers-outline" size={36} color={colors.textDim} />
        </View>
        <Text style={styles.emptyTitle}>No Sessions Yet</Text>
        <Text style={styles.emptySubtitle}>Create the first session for {groupName}</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('NewGame', { groupId, groupName })}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.background} />
          <Text style={styles.createButtonText}>New Game</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.listWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={sessions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            onPress={() => {
              navigation.navigate('Session', { sessionId: item.id, groupId });
            }}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Animated.View>
  );
}

function formatDuration(startedAt: string, endedAt: string): string {
  const mins = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function SessionCard({ session, onPress }: { session: SessionSummaryDto; onPress: () => void }) {
  const date = session.startedAt ?? session.createdAt;
  const dateStr = new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const pl = session.myProfitLoss;
  const isActive = session.status === 'Active';
  const isFinished = session.status === 'Finished';
  const showPL = isFinished && pl != null;
  const duration = isFinished && session.startedAt && session.endedAt
    ? formatDuration(session.startedAt, session.endedAt)
    : null;
  const plColor = pl != null && pl >= 0 ? colors.success : colors.error;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.cardAccent, isActive && styles.cardAccentActive]} />
      <View style={styles.cardInner}>
        <View style={styles.cardTop}>
          <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>
          <View style={styles.cardTopRight}>
            {showPL && pl != null && (
              <Text style={[styles.plText, { color: plColor }]}>
                {pl >= 0 ? '+' : ''}₪{Math.abs(pl).toLocaleString()}
              </Text>
            )}
            <StatusBadge status={session.status} />
          </View>
        </View>
        <View style={styles.cardMeta}>
          <Ionicons name="people-outline" size={12} color={colors.textDim} />
          <Text style={styles.metaText}>
            {session.playerCount} player{session.playerCount !== 1 ? 's' : ''}
          </Text>
          <View style={styles.dot} />
          <Text style={styles.metaText}>{dateStr}</Text>
          {duration && (
            <>
              <View style={styles.dot} />
              <Ionicons name="time-outline" size={12} color={colors.textDim} />
              <Text style={styles.metaText}>{duration}</Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'Active';
  const isDraft = status === 'Draft';
  return (
    <View style={[styles.badge, isActive ? styles.badgeActive : isDraft ? styles.badgeDraft : styles.badgeFinished]}>
      {isActive && <View style={styles.activeDot} />}
      <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextMuted]}>
        {isActive ? 'LIVE' : status.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listWrap: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 60 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { height: 10 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardAccent: {
    width: 3,
    backgroundColor: colors.border,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardAccentActive: { backgroundColor: colors.gold },
  cardInner: { flex: 1, padding: 16, gap: 8 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plText: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sessionName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: { fontSize: 12, color: colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textDim },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeActive: {
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: colors.goldMuted,
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
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeTextActive: { color: colors.gold },
  badgeTextMuted: { color: colors.textMuted },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 13,
    backgroundColor: colors.gold,
    borderRadius: 12,
    ...shadows.goldSm,
  },
  createButtonText: { fontSize: 15, fontWeight: '700', color: colors.background },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center' },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
