import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { getPlayerProfile, getHeadToHead, PlayerProfileDto, HeadToHeadDto } from '../api/usersApi';
import * as storage from '../utils/storage';
import { formatPL, formatMoney, formatDate } from '../utils/formatters';
import StatWidget from '../components/StatWidget';
import SessionListItem from '../components/SessionListItem';
import SkeletonCard from '../components/SkeletonCard';

type Props = NativeStackScreenProps<RootStackParamList, 'PlayerProfile'>;

export default function PlayerProfileScreen({ route, navigation }: Props) {
  const { userId, username } = route.params;

  const [profile, setProfile] = useState<PlayerProfileDto | null>(null);
  const [h2h, setH2H] = useState<HeadToHeadDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await storage.getItemAsync('accessToken');
        const userStr = await storage.getItemAsync('user');
        const me = userStr ? JSON.parse(userStr) : null;
        if (!token) return;

        setMyUserId(me?.userId ?? null);

        const [profileData, h2hData] = await Promise.all([
          getPlayerProfile(token, userId),
          me?.userId && me.userId !== userId
            ? getHeadToHead(token, userId).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (!cancelled) {
          setProfile(profileData);
          setH2H(h2hData);
        }
      } catch (e: any) {
        if (!cancelled) setError('Failed to load player profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId]));

  const initials = username.slice(0, 2).toUpperCase();
  const isOwnProfile = myUserId === userId;

  if (loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.heroSkeleton}>
          <SkeletonCard height={72} borderRadius={36} style={{ width: 72 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonCard height={20} borderRadius={8} style={{ width: '60%' }} />
            <SkeletonCard height={14} borderRadius={6} style={{ width: '40%' }} />
          </View>
        </View>
        <View style={styles.statsRow}>
          <SkeletonCard height={90} borderRadius={14} />
          <SkeletonCard height={90} borderRadius={14} />
          <SkeletonCard height={90} borderRadius={14} />
        </View>
        <SkeletonCard height={64} borderRadius={14} />
        <SkeletonCard height={220} borderRadius={14} />
      </ScrollView>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Player not found.'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const plColor = profile.totalProfitLoss > 0
    ? colors.goldLight
    : profile.totalProfitLoss < 0
      ? colors.error
      : colors.textMuted;

  const streakLabel = profile.currentStreak > 0
    ? `🔥 ${profile.currentStreak}-game win streak`
    : profile.currentStreak < 0
      ? `❄️ ${Math.abs(profile.currentStreak)}-game skid`
      : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.heroName}>{profile.username}</Text>
          <Text style={styles.heroSub}>
            {profile.totalSessionsPlayed} sessions · {profile.winRate}% win rate
          </Text>
          {streakLabel && (
            <Text style={styles.streakLabel}>{streakLabel}</Text>
          )}
        </View>
      </View>

      {/* Career numbers */}
      <View style={styles.statsRow}>
        <StatWidget
          label="Total P&L"
          value={formatPL(profile.totalProfitLoss)}
          valueColor={plColor}
          ionicon="trending-up"
          accentColor={plColor}
          delay={0}
        />
        <StatWidget
          label="Best Win"
          value={profile.biggestWin != null ? formatPL(profile.biggestWin) : '—'}
          valueColor={colors.goldLight}
          ionicon="trophy"
          accentColor={colors.goldLight}
          delay={80}
        />
        <StatWidget
          label="Avg / Session"
          value={formatPL(profile.averageProfitLoss)}
          valueColor={profile.averageProfitLoss >= 0 ? colors.goldLight : colors.error}
          ionicon="stats-chart"
          delay={160}
        />
      </View>

      {/* W/L/E record */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Record</Text>
        <View style={styles.recordRow}>
          <View style={styles.recordItem}>
            <Text style={[styles.recordValue, { color: colors.success }]}>{profile.winsCount}</Text>
            <Text style={styles.recordLabel}>Won</Text>
          </View>
          <View style={styles.recordDivider} />
          <View style={styles.recordItem}>
            <Text style={[styles.recordValue, { color: colors.error }]}>{profile.lossesCount}</Text>
            <Text style={styles.recordLabel}>Lost</Text>
          </View>
          <View style={styles.recordDivider} />
          <View style={styles.recordItem}>
            <Text style={[styles.recordValue, { color: colors.textMuted }]}>{profile.breakEvenCount}</Text>
            <Text style={styles.recordLabel}>Even</Text>
          </View>
          {profile.longestWinStreak > 0 && (
            <>
              <View style={styles.recordDivider} />
              <View style={styles.recordItem}>
                <Text style={[styles.recordValue, { color: colors.gold }]}>{profile.longestWinStreak}</Text>
                <Text style={styles.recordLabel}>Best Streak</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Recent form */}
      {profile.recentForm.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Form</Text>
          <View style={styles.formRow}>
            {profile.recentForm.map((outcome, i) => (
              <View
                key={i}
                style={[
                  styles.formDot,
                  outcome === 'W' && styles.formDotWin,
                  outcome === 'L' && styles.formDotLoss,
                  outcome === 'E' && styles.formDotEven,
                ]}
              >
                <Text style={styles.formDotText}>{outcome}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.formCaption}>Oldest → Most recent</Text>
        </View>
      )}

      {/* Head-to-head (only when viewing someone else's profile) */}
      {!isOwnProfile && h2h && h2h.sessionsTogether > 0 && (
        <View style={styles.h2hCard}>
          <Text style={styles.sectionTitle}>You vs. {profile.username}</Text>
          <View style={styles.h2hStats}>
            <View style={styles.h2hSide}>
              <Text style={[styles.h2hValue, { color: colors.goldLight }]}>{h2h.myWins}</Text>
              <Text style={styles.h2hLabel}>Your wins</Text>
            </View>
            <View style={styles.h2hCenter}>
              <Text style={styles.h2hSessions}>{h2h.sessionsTogether}</Text>
              <Text style={styles.h2hCenterLabel}>sessions together</Text>
            </View>
            <View style={styles.h2hSide}>
              <Text style={[styles.h2hValue, { color: colors.textMuted }]}>{h2h.opponentWins}</Text>
              <Text style={styles.h2hLabel}>Their wins</Text>
            </View>
          </View>
          <View style={styles.h2hPL}>
            <Text style={styles.h2hPLLabel}>Your net P&L in shared sessions</Text>
            <Text style={[
              styles.h2hPLValue,
              { color: h2h.myProfitVsOpponent >= 0 ? colors.goldLight : colors.error },
            ]}>
              {formatPL(h2h.myProfitVsOpponent)}
            </Text>
          </View>
          {h2h.recentMatchups.length > 0 && (
            <View style={styles.matchupsList}>
              <Text style={styles.matchupsTitle}>Recent matchups</Text>
              {h2h.recentMatchups.map((m, i) => (
                <View key={m.sessionId} style={[styles.matchupRow, i > 0 && styles.matchupBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchupName} numberOfLines={1}>{m.sessionName}</Text>
                    <Text style={styles.matchupGroup}>{m.groupName} · {formatDate(m.date)}</Text>
                  </View>
                  <View style={styles.matchupPLs}>
                    <Text style={[styles.matchupPL, { color: m.myProfitLoss >= 0 ? colors.goldLight : colors.error }]}>
                      {formatPL(m.myProfitLoss)}
                    </Text>
                    <Text style={[styles.matchupPL, { color: m.opponentProfitLoss >= 0 ? colors.success : colors.textMuted }]}>
                      {formatPL(m.opponentProfitLoss)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Recent sessions */}
      {profile.recentSessions.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {profile.recentSessions.map((s, i) => (
            <SessionListItem
              key={s.sessionId}
              name={s.sessionName}
              meta={`${s.groupName} · ${formatDate(s.date)}`}
              profitLoss={s.profitLoss}
              onPress={() => navigation.navigate('Session', { sessionId: s.sessionId, groupId: s.groupId ?? '' })}
              isFirst={i === 0}
            />
          ))}
        </View>
      )}

      {profile.totalSessionsPlayed === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🃏</Text>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>{profile.username} hasn't finished any sessions.</Text>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 12 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 },

  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1,
  },
  heroInfo: { flex: 1, gap: 4 },
  heroName: { ...typography.h2, color: colors.text },
  heroSub: { ...typography.body, color: colors.textMuted },
  streakLabel: { ...typography.labelSmall, color: colors.gold, marginTop: 2 },

  // Skeleton hero
  heroSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 8,
  },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10 },

  // Generic card
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    ...shadows.md,
  },
  sectionTitle: {
    ...typography.caps,
    color: colors.textMuted,
  },

  // Record
  recordRow: { flexDirection: 'row', alignItems: 'center' },
  recordItem: { flex: 1, alignItems: 'center', gap: 4 },
  recordValue: { ...typography.h2 },
  recordLabel: { ...typography.caption, color: colors.textMuted },
  recordDivider: { width: 1, height: 32, backgroundColor: colors.border },

  // Recent form dots
  formRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  formDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  formDotWin: { backgroundColor: 'rgba(39,174,96,0.20)', borderWidth: 1, borderColor: 'rgba(39,174,96,0.5)' },
  formDotLoss: { backgroundColor: 'rgba(231,76,60,0.20)', borderWidth: 1, borderColor: 'rgba(231,76,60,0.5)' },
  formDotEven: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  formDotText: { fontSize: 10, fontWeight: '700', color: colors.text },
  formCaption: { ...typography.caption, color: colors.textDim },

  // H2H card
  h2hCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    padding: 16,
    gap: 12,
    ...shadows.gold,
  },
  h2hStats: { flexDirection: 'row', alignItems: 'center' },
  h2hSide: { flex: 1, alignItems: 'center', gap: 4 },
  h2hValue: { ...typography.h1 },
  h2hLabel: { ...typography.caption, color: colors.textMuted },
  h2hCenter: { flex: 1, alignItems: 'center', gap: 2 },
  h2hSessions: { ...typography.h2, color: colors.text },
  h2hCenterLabel: { ...typography.caption, color: colors.textDim, textAlign: 'center' },
  h2hPL: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  h2hPLLabel: { ...typography.bodySmall, color: colors.textMuted },
  h2hPLValue: { ...typography.label },
  matchupsList: { gap: 0 },
  matchupsTitle: { ...typography.caps, color: colors.textDim, marginBottom: 4 },
  matchupRow: { paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchupBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  matchupName: { ...typography.labelSmall, color: colors.text },
  matchupGroup: { ...typography.caption, color: colors.textMuted },
  matchupPLs: { gap: 2, alignItems: 'flex-end' },
  matchupPL: { ...typography.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Empty
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptySub: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  // Error
  errorText: { ...typography.body, color: colors.error, textAlign: 'center' },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: { ...typography.label, color: colors.textMuted },
});
