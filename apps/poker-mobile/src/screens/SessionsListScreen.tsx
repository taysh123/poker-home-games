import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { getGroupSessions, SessionSummaryDto } from '../api/sessionsApi';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionsList'>;

export default function SessionsListScreen({ route, navigation }: Props) {
  const { groupId, groupName, userRole } = route.params;

  const [sessions, setSessions] = useState<SessionSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Sessions',
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('NewGame', { groupId, groupName })}
          style={{ marginRight: 4 }}
        >
          <Text style={{ color: colors.gold, fontSize: 28, lineHeight: 32 }}>+</Text>
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        <TouchableOpacity style={styles.retryButton} onPress={() => load()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🃏</Text>
        <Text style={styles.emptyTitle}>No Sessions Yet</Text>
        <Text style={styles.emptySubtitle}>Create the first session for {groupName}</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('NewGame', { groupId, groupName })}
        >
          <Text style={styles.createButtonText}>Create Session</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
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
  );
}

function SessionCard({ session, onPress }: { session: SessionSummaryDto; onPress: () => void }) {
  const date = session.startedAt ?? session.createdAt;
  const dateStr = new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const pl = session.myProfitLoss;
  const showPL = session.status === 'Finished' && pl != null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>
        <View style={styles.cardTopRight}>
          {showPL && (
            <Text style={[styles.plText, pl >= 0 ? styles.plPositive : styles.plNegative]}>
              {pl >= 0 ? '+' : ''}₪{Math.abs(pl).toLocaleString()}
            </Text>
          )}
          <StatusBadge status={session.status} />
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>
          {session.playerCount} player{session.playerCount !== 1 ? 's' : ''}
        </Text>
        <View style={styles.dot} />
        <Text style={styles.metaText}>{dateStr}</Text>
      </View>
    </TouchableOpacity>
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

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  separator: { height: 10 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
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
  plText: { fontSize: 15, fontWeight: '800' },
  plPositive: { color: colors.success },
  plNegative: { color: colors.error },
  sessionName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: { fontSize: 13, color: colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textDim },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
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
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeTextActive: { color: colors.gold },
  badgeTextMuted: { color: colors.textMuted },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  createButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.gold,
    borderRadius: 10,
  },
  createButtonText: { fontSize: 15, fontWeight: '700', color: colors.background },
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
