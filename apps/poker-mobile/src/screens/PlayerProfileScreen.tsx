import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import { shadows } from '../theme/shadows';
import { getPlayerProfile, getHeadToHead, PlayerProfileDto, HeadToHeadDto } from '../api/usersApi';
import * as storage from '../utils/storage';
import { formatPL, formatDate } from '../utils/formatters';
import StatWidget from '../components/StatWidget';
import SessionListItem from '../components/SessionListItem';
import SkeletonCard from '../components/SkeletonCard';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import ProgressBar from '../components/ProgressBar';
import PrimaryButton from '../components/PrimaryButton';
import AnimatedNumber from '../components/motion/AnimatedNumber';
import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = NativeStackScreenProps<RootStackParamList, 'PlayerProfile'>;

export default function PlayerProfileScreen({ route, navigation }: Props) {
  const { userId, username } = route.params;
  const reduced = useReducedMotion();

  const [profile, setProfile] = useState<PlayerProfileDto | null>(null);
  const [h2h, setH2H] = useState<HeadToHeadDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
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

      setProfile(profileData);
      setH2H(h2hData);
    } catch (e: any) {
      setError('Failed to load player profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void loadProfile();
  }, [loadProfile]));

  const onRefresh = useCallback(() => { setRefreshing(true); void loadProfile(true); }, [loadProfile]);

  const isOwnProfile = myUserId === userId;

  // Velvet Table header (replaces the old native navigation header)
  const header = (
    <ScreenHeader title={username} onBack={() => navigation.goBack()} />
  );

  if (loading) {
    return (
      <Screen>
        {header}
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.heroSkeleton}>
            <SkeletonCard height={72} borderRadius={36} style={{ width: 72 }} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <SkeletonCard height={20} borderRadius={radii.sm} style={{ width: '60%' }} />
              <SkeletonCard height={14} borderRadius={6} style={{ width: '40%' }} />
            </View>
          </View>
          <View style={styles.statsRow}>
            <SkeletonCard height={90} borderRadius={radii.md} />
            <SkeletonCard height={90} borderRadius={radii.md} />
            <SkeletonCard height={90} borderRadius={radii.md} />
          </View>
          <SkeletonCard height={64} borderRadius={radii.md} />
          <SkeletonCard height={220} borderRadius={radii.md} />
        </ScrollView>
      </Screen>
    );
  }

  if (error || !profile) {
    return (
      <Screen>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Player not found.'}</Text>
          <PrimaryButton
            label="Go Back"
            variant="outline"
            fullWidth={false}
            onPress={() => navigation.goBack()}
          />
        </View>
      </Screen>
    );
  }

  const plColor = profile.totalProfitLoss > 0
    ? colors.goldLight
    : profile.totalProfitLoss < 0
      ? colors.error
      : colors.textMuted;

  const winRateColor = profile.winRate >= 50 ? colors.success : colors.textMuted;

  const streak = profile.currentStreak > 0
    ? { icon: 'flame' as const, text: `${profile.currentStreak}-game win streak`, color: colors.gold }
    : profile.currentStreak < 0
      ? { icon: 'snow' as const, text: `${Math.abs(profile.currentStreak)}-game skid`, color: colors.info }
      : null;

  const heroA11y = `${profile.username}, ${formatPL(profile.totalProfitLoss)}, `
    + `${profile.totalSessionsPlayed} sessions, ${profile.winRate}% win rate`
    + (streak ? `, ${streak.text}` : '');

  return (
    <Screen>
    {header}
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.gold}
          colors={[colors.gold]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      {/* Hero */}
      <MotiView
        style={styles.hero}
        accessible
        accessibilityLabel={heroA11y}
        {...slideUpSequence({ reduced })}
      >
        <Avatar
          name={profile.username}
          size={72}
          ring={profile.totalProfitLoss > 0
            ? colors.goldMuted
            : profile.totalProfitLoss < 0
              ? colors.errorMuted
              : undefined}
          style={profile.totalProfitLoss !== 0 ? { borderWidth: 2.5 } : undefined}
        />
        <View style={styles.heroInfo}>
          <Text style={styles.heroName}>{profile.username}</Text>
          <AnimatedNumber
            value={profile.totalProfitLoss}
            format={formatPL}
            style={[styles.heroPL, { color: plColor }]}
          />
          <Text style={styles.heroSub}>
            {profile.totalSessionsPlayed} sessions · {profile.winRate}% win rate
          </Text>
          {streak && (
            <View style={styles.streakRow}>
              <Ionicons name={streak.icon} size={iconSize.xs} color={streak.color} />
              <Text style={[styles.streakLabel, { color: streak.color }]}>{streak.text}</Text>
            </View>
          )}
        </View>
      </MotiView>

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
      <MotiView style={styles.card} {...slideUpSequence({ reduced, delay: staggerIn(1) })}>
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
        {profile.totalSessionsPlayed > 0 && (
          <View style={styles.winRateWrap}>
            <View style={styles.winRateLabelRow}>
              <Text style={styles.winRateCaption}>Win rate</Text>
              <Text style={[styles.winRatePct, { color: winRateColor }]}>{profile.winRate}%</Text>
            </View>
            <ProgressBar
              value={profile.winRate / 100}
              fillColor={winRateColor === colors.success ? colors.success : colors.gold}
              accessibilityLabel={`Win rate ${profile.winRate} percent`}
            />
          </View>
        )}
      </MotiView>

      {/* Recent form */}
      {profile.recentForm.length > 0 && (
        <MotiView style={styles.card} {...slideUpSequence({ reduced, delay: staggerIn(2) })}>
          <Text style={styles.sectionTitle}>Recent Form</Text>
          <View style={styles.formRow}>
            {profile.recentForm.map((outcome, i) => (
              <View
                key={i}
                accessible
                accessibilityLabel={outcome === 'W' ? 'Win' : outcome === 'L' ? 'Loss' : 'Even'}
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
        </MotiView>
      )}

      {/* Head-to-head (only when viewing someone else's profile) */}
      {!isOwnProfile && h2h && h2h.sessionsTogether > 0 && (
        <MotiView style={styles.h2hCard} {...slideUpSequence({ reduced, delay: staggerIn(3) })}>
          <Text style={styles.sectionTitle}>You vs. {profile.username}</Text>
          <View style={styles.verdictChip}>
            <Text style={[styles.verdictText, {
              color: h2h.myWins > h2h.opponentWins
                ? colors.success
                : h2h.myWins < h2h.opponentWins
                  ? colors.textMuted
                  : colors.textDim,
            }]}>
              {h2h.myWins > h2h.opponentWins ? 'YOU LEAD'
                : h2h.myWins < h2h.opponentWins ? 'THEY LEAD'
                : 'TIED'}
            </Text>
          </View>
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
        </MotiView>
      )}

      {/* Recent sessions */}
      {profile.recentSessions.length > 0 && (
        <MotiView style={styles.card} {...slideUpSequence({ reduced, delay: staggerIn(4) })}>
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
        </MotiView>
      )}

      {profile.totalSessionsPlayed === 0 && (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="albums-outline" size={iconSize.lg} color={colors.textDim} />
          </View>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>{profile.username} hasn't finished any sessions.</Text>
        </View>
      )}

      <View style={{ height: spacing.xxxl }} />
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },

  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  heroInfo: { flex: 1, gap: spacing.xs },
  heroName: { ...typography.h2, color: colors.text },
  heroPL: { ...typography.amountLarge, letterSpacing: -0.5 },
  heroSub: { ...typography.body, color: colors.textMuted },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  streakLabel: { ...typography.labelSmall },

  // Skeleton hero
  heroSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },

  // Stats row
  statsRow: { flexDirection: 'row', gap: spacing.sm },

  // Generic card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.md,
  },
  sectionTitle: {
    ...typography.caps,
    color: colors.textMuted,
  },

  // Record
  recordRow: { flexDirection: 'row', alignItems: 'center' },
  recordItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  recordValue: { ...typography.h2 },
  recordLabel: { ...typography.caption, color: colors.textMuted },
  recordDivider: { width: 1, height: 32, backgroundColor: colors.border },

  // Win-rate bar
  winRateWrap: { gap: spacing.sm },
  winRateLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  winRateCaption: { ...typography.caption, color: colors.textMuted },
  winRatePct: { ...typography.labelSmall, fontVariant: ['tabular-nums'] },

  // Recent form dots
  formRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  formDot: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  formDotWin: { backgroundColor: colors.success + '33', borderWidth: 1, borderColor: colors.success + '80' },
  formDotLoss: { backgroundColor: colors.error + '33', borderWidth: 1, borderColor: colors.error + '80' },
  formDotEven: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  formDotText: { ...typography.caption, fontWeight: '700', color: colors.text },
  formCaption: { ...typography.caption, color: colors.textDim },

  // H2H verdict
  verdictChip: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  verdictText: {
    ...typography.caps,
    fontWeight: '800',
  },

  // H2H card
  h2hCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.gold,
  },
  h2hStats: { flexDirection: 'row', alignItems: 'center' },
  h2hSide: { flex: 1, alignItems: 'center', gap: spacing.xs },
  h2hValue: { ...typography.h1 },
  h2hLabel: { ...typography.caption, color: colors.textMuted },
  h2hCenter: { flex: 1, alignItems: 'center', gap: 2 },
  h2hSessions: { ...typography.h2, color: colors.text },
  h2hCenterLabel: { ...typography.caption, color: colors.textDim, textAlign: 'center' },
  h2hPL: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  h2hPLLabel: { ...typography.bodySmall, color: colors.textMuted },
  h2hPLValue: { ...typography.label },
  matchupsList: { gap: 0 },
  matchupsTitle: { ...typography.caps, color: colors.textDim, marginBottom: spacing.xs },
  matchupRow: { paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  matchupBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  matchupName: { ...typography.labelSmall, color: colors.text },
  matchupGroup: { ...typography.caption, color: colors.textMuted },
  matchupPLs: { gap: 2, alignItems: 'flex-end' },
  matchupPL: { ...typography.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Empty
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptySub: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  // Error
  errorText: { ...typography.body, color: colors.error, textAlign: 'center' },
});
