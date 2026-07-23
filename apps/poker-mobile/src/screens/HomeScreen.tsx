import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Sora } from '../theme/fonts';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { pulse, fadeIn, slideUp } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useAuth } from '../context/AuthContext';
import { getMyGroups, getMyInvitations, getCrossGroupActivity, MyGroupDto, PendingInvitationDto, CrossGroupActivityDto } from '../api/groupsApi';
import { getMyNotifications } from '../api/notificationsApi';
import { getMyStats, MyStatsDto, RecentSessionDto } from '../api/statsApi';
import { getMyPendingSettlements, MyPendingSettlementDto } from '../api/settlementsApi';
import { getWeeklyDigest, WeeklyDigestDto } from '../api/digestApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import { goToSessions, goToStats } from '../navigation/navHelpers';
import RankBadge from '../components/RankBadge';
import { usePersona } from '../features/persona/state/PersonaContext';
import { heroVariantForGoal, drillCardSub } from '../features/persona/logic/recommendations';
import { useStudy } from '../features/study/state/StudyContext';
import { isFeatureEnabled } from '../config/features';
import SkeletonCard from '../components/SkeletonCard';
import StatWidget from '../components/StatWidget';
import SessionListItem from '../components/SessionListItem';
import GroupListItem from '../components/GroupListItem';
import Card from '../components/Card';
import { formatPL, formatMoney, formatDate, formatDuration, formatMinutes, timeAgo } from '../utils/formatters';
import AnimatedNumber from '../components/motion/AnimatedNumber';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import { useActiveSession } from '../context/ActiveSessionContext';

type HomeNav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const ACTIVITY_ICON_CFG: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; bg: string; color: string }> = {
  SessionEnded:        { icon: 'flag-outline',          bg: colors.errorFaint,              color: colors.error },
  SessionStarted:      { icon: 'play-circle-outline',   bg: colors.goldFaint,               color: colors.gold },
  SessionCreated:      { icon: 'add-circle-outline',    bg: colors.goldFaint,               color: colors.gold },
  AchievementUnlocked: { icon: 'trophy-outline',        bg: colors.goldFaint,               color: colors.gold },
  MemberJoined:        { icon: 'person-add-outline',    bg: 'rgba(39,174,96,0.10)',         color: colors.success },
  PlayerJoined:        { icon: 'people-outline',        bg: 'rgba(39,174,96,0.10)',         color: colors.success },
  MemberLeft:          { icon: 'person-remove-outline', bg: colors.errorFaint,              color: colors.textMuted },
  MemberRemoved:       { icon: 'close-circle-outline',  bg: colors.errorFaint,              color: colors.textMuted },
  _default:            { icon: 'ellipse-outline',       bg: colors.surfaceHigh,             color: colors.textMuted },
};

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { persona } = usePersona();
  const { limitFor } = useStudy();
  const navigation = useNavigation<HomeNav>();
  const insets = useSafeAreaInsets();
  // Honest drill hero (1.3): sub reflects the shared pool's actual remainder; spent pool ⇒ hidden.
  const drillSub = drillCardSub(limitFor('practiceQuestion').remaining);
  const showDrill =
    heroVariantForGoal(persona?.goal ?? null) === 'improver' &&
    isFeatureEnabled('study') &&
    drillSub !== null;
  const { refresh: refreshActiveSession } = useActiveSession();
  const reducedMotion = useReducedMotion();

  const [loggingOut, setLoggingOut] = useState(false);
  const [groups, setGroups] = useState<MyGroupDto[]>([]);
  const [stats, setStats] = useState<MyStatsDto | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [invitations, setInvitations] = useState<PendingInvitationDto[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<MyPendingSettlementDto[]>([]);
  const [crossGroupActivity, setCrossGroupActivity] = useState<CrossGroupActivityDto[]>([]);
  const [digest, setDigest] = useState<WeeklyDigestDto | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Entrance animations
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(20)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Live pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Respect OS Reduce Motion — keep the live indicator steady instead of pulsing.
    if (reducedMotion) { pulseAnim.setValue(1); return; }
    const loop = pulse(pulseAnim);
    loop.start();
    return () => loop.stop();
  }, [reducedMotion]);

  const hasAnimated = useRef(false);
  const runEntranceAnimation = useCallback(() => {
    // Reduced motion (or already-animated this mount): show final state instantly, no entrance.
    // The entrance is a once-per-mount beat; without this guard it re-fired on every tab focus.
    if (reducedMotion || hasAnimated.current) {
      heroOpacity.setValue(1);
      heroY.setValue(0);
      contentOpacity.setValue(1);
      return;
    }
    hasAnimated.current = true;
    heroOpacity.setValue(0);
    heroY.setValue(20);
    contentOpacity.setValue(0);
    Animated.sequence([
      Animated.parallel([
        fadeIn(heroOpacity, { duration: 350 }),
        slideUp(heroY, { duration: 350, from: 20 }),
      ]),
      fadeIn(contentOpacity, { duration: 300 }),
    ]).start();
  }, [reducedMotion]);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setStatsLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const [groupsData, statsData, invData, pendingData, notifData, activityData, digestData] = await Promise.all([
        getMyGroups(token),
        getMyStats(token),
        getMyInvitations(token),
        getMyPendingSettlements(token).catch(() => [] as MyPendingSettlementDto[]),
        getMyNotifications(token).catch(() => null),
        getCrossGroupActivity(token).catch(() => [] as CrossGroupActivityDto[]),
        getWeeklyDigest(token).catch(() => null),
      ]);
      setGroups(groupsData);
      setStats(statsData);
      setInvitations(invData);
      setPendingSettlements(pendingData);
      setUnreadNotifications(notifData?.unreadCount ?? 0);
      setCrossGroupActivity(activityData);
      setDigest(digestData);
    } catch {
      // silent — home screen degrades gracefully
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadAll();
    refreshActiveSession();
    runEntranceAnimation();
  }, [loadAll, refreshActiveSession, runEntranceAnimation]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll(true);
  }, [loadAll]);

  async function handleLogout() {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  }

  function openSession(s: RecentSessionDto) {
    navigation.navigate('Session', { sessionId: s.sessionId, groupId: s.groupId ?? '' });
  }

  const activeSessions = stats?.recentSessions.filter(s => s.status === 'Active') ?? [];
  const recentSessions = stats?.recentSessions.filter(s => s.status === 'Finished').slice(0, 4) ?? [];

  // "This week" P&L computed client-side from already-loaded sessions
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thisWeekPL = stats?.recentSessions
    .filter(s => s.status === 'Finished' && s.profitLoss != null && new Date(s.createdAt) >= oneWeekAgo)
    .reduce((sum, s) => sum + (s.profitLoss ?? 0), 0) ?? null;
  const hasThisWeekData = thisWeekPL !== null && stats != null && stats.recentSessions.some(
    s => s.status === 'Finished' && new Date(s.createdAt) >= oneWeekAgo
  );

  const topGroup = groups.length > 0
    ? groups.reduce((best, g) =>
        (g.myGroupPL ?? -Infinity) > (best.myGroupPL ?? -Infinity) ? g : best
      )
    : null;
  const showTopGroup = topGroup != null && topGroup.myGroupPL != null && topGroup.myGroupPL !== 0;

  const plValue = stats?.totalProfitLoss ?? 0;
  const plColor = plValue > 0 ? colors.success : plValue < 0 ? colors.error : colors.textMuted;
  const winRate = stats && stats.totalSessionsPlayed > 0
    ? Math.round((stats.winsCount / stats.totalSessionsPlayed) * 100)
    : null;
  const winRateColor = winRate != null && winRate >= 50 ? colors.success : colors.textMuted;

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.gold}
          progressBackgroundColor={colors.surface}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Brand bar ── */}
      <Animated.View style={[styles.header, { opacity: heroOpacity, transform: [{ translateY: heroY }] }]}>
        <View style={styles.brandLockup}>
          <View style={styles.brandLogoRing}>
            <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
          </View>
          <Text style={styles.brandWordmark}>T POKER</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
          >
            <Ionicons name="notifications-outline" size={20} color={unreadNotifications > 0 ? colors.gold : colors.textMuted} />
            {(unreadNotifications > 0 || invitations.length > 0) && (
              <View style={styles.notifDot} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <Avatar
              name={user?.username ?? '?'}
              emoji={user?.avatarEmoji}
              color={user?.avatarColor}
              size={40}
              ring="gold"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, loggingOut && { opacity: 0.5 }]}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            {loggingOut
              ? <ActivityIndicator color={colors.textMuted} size="small" />
              : <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Hero bankroll card (cinematic) ── */}
      <Animated.View style={[styles.heroCard, { opacity: heroOpacity, transform: [{ translateY: heroY }] }]}>
        <LinearGradient
          colors={[colors.goldFaint, 'transparent']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.heroGlow}
          pointerEvents="none"
        />
        <View style={styles.heroCardInner}>
          <Text style={styles.heroGreeting}>{greeting}, {user?.username ?? 'Player'}</Text>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Lifetime P&L</Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {stats?.totalSessionsPlayed ?? 0} session{(stats?.totalSessionsPlayed ?? 0) !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          {statsLoading ? (
            <SkeletonCard height={48} borderRadius={8} style={{ marginTop: 8, width: '60%' }} />
          ) : (
            <AnimatedNumber
              value={plValue}
              format={formatPL}
              style={[styles.heroValue, { color: plColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          )}
          {statsLoading ? (
            <SkeletonCard height={14} borderRadius={4} style={{ marginTop: 10, width: '40%' }} />
          ) : (
            <>
              <Text style={styles.heroSub}>
                {plValue > 0 ? 'You\'re in the green' : plValue < 0 ? 'Keep grinding' : 'Break even'}
              </Text>
              {hasThisWeekData && thisWeekPL !== null && (
                <View style={styles.weekChipRow}>
                  <View style={[styles.weekChip, thisWeekPL >= 0 ? styles.weekChipGreen : styles.weekChipRed]}>
                    <Ionicons
                      name={thisWeekPL >= 0 ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={thisWeekPL >= 0 ? colors.success : colors.error}
                    />
                    <Text style={[styles.weekChipText, { color: thisWeekPL >= 0 ? colors.success : colors.error }]}>
                      {formatPL(thisWeekPL)} this week
                    </Text>
                  </View>
                </View>
              )}
              {stats?.currentStreak !== 0 && stats?.currentStreak != null && (
                <View style={styles.streakChip}>
                  <Text style={styles.streakEmoji}>
                    {stats.currentStreak > 0 ? '🔥' : '❄️'}
                  </Text>
                  <Text style={styles.streakText}>
                    {Math.abs(stats.currentStreak)}-game {stats.currentStreak > 0 ? 'win' : 'loss'} streak
                  </Text>
                </View>
              )}
              {showTopGroup && topGroup && topGroup.myGroupPL != null && (
                <TouchableOpacity
                  style={styles.topGroupChip}
                  onPress={() => navigation.navigate('GroupDetail', { groupId: topGroup.id, groupName: topGroup.name })}
                  activeOpacity={0.75}
                >
                  <Ionicons name="trophy-outline" size={12} color={colors.gold} />
                  <Text style={styles.topGroupText} numberOfLines={1}>
                    Top group: {topGroup.name} {topGroup.myGroupPL > 0 ? '+' : ''}{formatMoney(topGroup.myGroupPL)}
                  </Text>
                  <Ionicons name="chevron-forward" size={11} color={colors.goldMuted} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
        {/* decorative corner element */}
        <View style={styles.heroCorner} pointerEvents="none" />
        <View style={styles.heroCorner2} pointerEvents="none" />
      </Animated.View>

      <Animated.View style={{ opacity: contentOpacity }}>

        {/* ── Weekly Digest ── */}
        {statsLoading ? (
          <SkeletonCard height={120} style={styles.digestSkeleton} />
        ) : digest && digest.sessionsPlayed > 0 ? (
          <Card variant="hero" style={styles.digestCard}>
            <Text style={styles.digestTitle}>Your Poker Week</Text>
            <View style={styles.digestRow}>
              <Ionicons name="layers-outline" size={15} color={colors.gold} style={styles.digestIcon} />
              <Text style={styles.digestLabel}>Games played</Text>
              <Text style={styles.digestValue}>{digest.sessionsPlayed}</Text>
            </View>
            <View style={styles.digestRow}>
              <Ionicons
                name={digest.netProfitLoss >= 0 ? 'trending-up' : 'trending-down'}
                size={15}
                color={digest.netProfitLoss > 0 ? colors.success : digest.netProfitLoss < 0 ? colors.error : colors.textMuted}
                style={styles.digestIcon}
              />
              <Text style={styles.digestLabel}>Net P&L</Text>
              <AnimatedNumber
                value={digest.netProfitLoss}
                format={formatPL}
                style={[
                  styles.digestValue,
                  { color: digest.netProfitLoss > 0 ? colors.success : digest.netProfitLoss < 0 ? colors.error : colors.textMuted },
                ]}
              />
            </View>
            {digest.bestNight && (
              <View style={styles.digestRow}>
                <Ionicons name="trophy-outline" size={15} color={colors.gold} style={styles.digestIcon} />
                <Text style={styles.digestLabel}>Best night</Text>
                <Text style={styles.digestValue} numberOfLines={1}>
                  {digest.bestNight.sessionName}{'  '}
                  <Text style={{ color: digest.bestNight.profitLoss >= 0 ? colors.success : colors.error }}>
                    {formatPL(digest.bestNight.profitLoss)}
                  </Text>
                </Text>
              </View>
            )}
            {digest.mostActiveGroup && (
              <View style={styles.digestRow}>
                <Ionicons name="people-outline" size={15} color={colors.gold} style={styles.digestIcon} />
                <Text style={styles.digestLabel}>Most active group</Text>
                <Text style={styles.digestValue} numberOfLines={1}>
                  {digest.mostActiveGroup.groupName} · {digest.mostActiveGroup.gamesCount} game{digest.mostActiveGroup.gamesCount !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
            <View style={styles.digestRow}>
              <Ionicons name="time-outline" size={15} color={colors.gold} style={styles.digestIcon} />
              <Text style={styles.digestLabel}>Time played</Text>
              <Text style={styles.digestValue}>{formatMinutes(digest.totalMinutesPlayed)}</Text>
            </View>
            {digest.currentStreak !== 0 && (
              <View style={styles.digestRow}>
                <Text style={styles.digestEmoji}>{digest.currentStreak > 0 ? '🔥' : '❄️'}</Text>
                <Text style={styles.digestLabel}>Streak</Text>
                <Text style={[styles.digestValue, { color: digest.currentStreak > 0 ? colors.success : colors.error }]}>
                  {Math.abs(digest.currentStreak)}-game {digest.currentStreak > 0 ? 'win' : 'loss'} streak
                </Text>
              </View>
            )}
          </Card>
        ) : digest ? (
          <TouchableOpacity
            style={styles.digestPromptCard}
            onPress={() => navigation.navigate('NewGame', {})}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles-outline" size={16} color={colors.gold} />
            <Text style={styles.digestPromptText}>Quiet week — deal someone in →</Text>
          </TouchableOpacity>
        ) : null}

        {/* ── Active Game Banner ── */}
        {activeSessions.map(s => (
          <TouchableOpacity
            key={s.sessionId}
            style={styles.liveBanner}
            onPress={() => openSession(s)}
            activeOpacity={0.85}
          >
            <View style={styles.liveBannerLeft}>
              <View style={styles.livePillRow}>
                <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                <Text style={styles.livePillText}>LIVE NOW</Text>
              </View>
              <Text style={styles.liveBannerName} numberOfLines={1}>{s.sessionName}</Text>
              <Text style={styles.liveBannerMeta}>{s.groupName ?? 'Solo game'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gold} />
          </TouchableOpacity>
        ))}

        {/* ── Pending Settlements Alert ── */}
        {pendingSettlements.length > 0 && (
          <TouchableOpacity
            style={styles.settlementsAlert}
            onPress={() => navigation.navigate('PendingSettlements')}
            activeOpacity={0.8}
          >
            <View style={styles.alertIconWrap}>
              <Ionicons name="cash-outline" size={18} color={colors.error} />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>
                {pendingSettlements.length} pending settlement{pendingSettlements.length !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.alertSub}>
                {(() => {
                  const owes = pendingSettlements.filter(s => s.payerUserId === user?.userId).reduce((sum, s) => sum + s.amount, 0);
                  const owed = pendingSettlements.filter(s => s.receiverUserId === user?.userId).reduce((sum, s) => sum + s.amount, 0);
                  if (owes > 0 && owed > 0) return `You owe ${formatMoney(owes)} · Owed ${formatMoney(owed)}`;
                  if (owes > 0) return `You owe ${formatMoney(owes)}`;
                  if (owed > 0) return `You're owed ${formatMoney(owed)}`;
                  return 'Tap to view and settle up';
                })()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </TouchableOpacity>
        )}

        {/* ── Pending Invitations Banner ── */}
        {invitations.length > 0 && (
          <TouchableOpacity
            style={styles.invitationsAlert}
            onPress={() => navigation.navigate('Invitations')}
            activeOpacity={0.8}
          >
            <View style={styles.inviteIconWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.gold} />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>
                {invitations.length} group invitation{invitations.length !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.alertSub}>Tap to view and respond</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </TouchableOpacity>
        )}

        {/* ── Today's drill — improvers lead with study (1.3; goal-led, pool-honest) ── */}
        {showDrill && (
          <TouchableOpacity
            style={styles.drillCard}
            onPress={() => navigation.navigate('StudyTrainer', { mode: 'spot' })}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Today's drill. ${drillSub}.`}
          >
            <View style={styles.newGameLeft}>
              <View style={styles.drillIconWrap}>
                <Ionicons name="flash" size={16} color={colors.background} />
              </View>
              <View>
                <Text style={styles.drillTitle}>Today's drill</Text>
                <Text style={styles.drillSub}>{drillSub}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.gold} />
          </TouchableOpacity>
        )}

        {/* ── New Game CTA ── */}
        <TouchableOpacity
          style={styles.newGameCard}
          onPress={() => navigation.navigate('NewGame', {})}
          activeOpacity={0.88}
        >
          <View style={styles.newGameLeft}>
            <View style={styles.newGameIconWrap}>
              <Ionicons name="play" size={18} color={colors.background} />
            </View>
            <View>
              <Text style={styles.newGameTitle}>Start a Game</Text>
              <Text style={styles.newGameSub}>Deal in your crew for tonight</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(15,25,35,0.5)" />
        </TouchableOpacity>

        {/* ── Tournament CTA (local-first) ── */}
        <TouchableOpacity
          style={styles.tournamentCard}
          onPress={() => navigation.navigate('LocalNewGame', { mode: 'tournament' })}
          activeOpacity={0.85}
        >
          <View style={styles.newGameLeft}>
            <View style={styles.tournamentIconWrap}>
              <Ionicons name="trophy" size={16} color={colors.gold} />
            </View>
            <View>
              <Text style={styles.tournamentTitle}>Host a Tournament</Text>
              <Text style={styles.tournamentSub}>Blind clock, buy-in tracking, podium · runs on this device</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gold} />
        </TouchableOpacity>

        {/* Rank / XP (retention only; renders null when off) */}
        <RankBadge onPress={() => navigation.navigate('Achievements')} />

        {/* ── Stats Widgets ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Your Numbers</Text>
            <TouchableOpacity onPress={() => goToStats(navigation)}>
              <Text style={styles.seeAll}>Full stats</Text>
            </TouchableOpacity>
          </View>

          {statsLoading ? (
            <View style={styles.statsGrid}>
              {[0, 1, 2].map(i => (
                <View key={i} style={styles.statSkeletonCard}>
                  <SkeletonCard height={28} borderRadius={6} style={{ marginBottom: 8 }} />
                  <SkeletonCard height={10} borderRadius={4} style={{ width: '70%' }} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <StatWidget
                label="Sessions"
                value={String(stats?.totalSessionsPlayed ?? 0)}
                ionicon="layers-outline"
                accentColor={colors.gold}
                delay={0}
              />
              <StatWidget
                label="Win Rate"
                value={winRate != null ? `${winRate}%` : '—'}
                ionicon="trophy-outline"
                accentColor={winRateColor}
                valueColor={winRateColor}
                delay={80}
              />
              <StatWidget
                label="Avg Session"
                value={stats?.averageProfitLoss != null ? formatPL(stats.averageProfitLoss) : '—'}
                ionicon="stats-chart-outline"
                accentColor={
                  (stats?.averageProfitLoss ?? 0) > 0
                    ? colors.success
                    : (stats?.averageProfitLoss ?? 0) < 0
                      ? colors.error
                      : colors.textMuted
                }
                valueColor={
                  (stats?.averageProfitLoss ?? 0) > 0
                    ? colors.success
                    : (stats?.averageProfitLoss ?? 0) < 0
                      ? colors.error
                      : colors.text
                }
                delay={160}
              />
            </View>
          )}
        </View>

        {/* ── Recent Sessions ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            <TouchableOpacity onPress={() => goToSessions(navigation)}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {statsLoading ? (
            <View style={styles.card}>
              {[0, 1, 2].map(i => (
                <View key={i} style={[styles.skeletonRow, i > 0 && styles.skeletonBorder]}>
                  <View style={styles.skeletonAccent} />
                  <View style={{ flex: 1, gap: 8, paddingLeft: 12 }}>
                    <SkeletonCard height={14} borderRadius={4} style={{ width: '60%' }} />
                    <SkeletonCard height={10} borderRadius={4} style={{ width: '40%' }} />
                  </View>
                  <SkeletonCard height={14} borderRadius={4} style={{ width: 48 }} />
                </View>
              ))}
            </View>
          ) : recentSessions.length === 0 ? (
            <View style={styles.sessionsEmptyCard}>
              <Ionicons name="game-controller-outline" size={28} color={colors.textDim} />
              <Text style={styles.sessionsEmptyTitle}>No games yet</Text>
              <Text style={styles.sessionsEmptySub}>Start one with your crew and track every hand</Text>
              <TouchableOpacity
                style={styles.sessionsEmptyCta}
                onPress={() => navigation.navigate('NewGame', {})}
                activeOpacity={0.8}
              >
                <Text style={styles.sessionsEmptyCtaText}>Start a Game</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              {recentSessions.map((s, i) => (
                <SessionListItem
                  key={s.sessionId}
                  name={s.sessionName}
                  meta={[
                    s.groupName ?? 'Solo',
                    formatDate(s.createdAt),
                    s.startedAt && s.endedAt ? formatDuration(s.startedAt, s.endedAt) : null,
                  ].filter(Boolean).join('  ·  ')}
                  profitLoss={s.profitLoss}
                  status={s.status}
                  onPress={() => openSession(s)}
                  isFirst={i === 0}
                  showResultBadge
                />
              ))}
            </View>
          )}
        </View>

        {/* ── My Groups ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My Groups</Text>
            {groups.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('GroupsList')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {statsLoading && groups.length === 0 ? (
            <View style={styles.card}>
              {[0, 1].map(i => (
                <View key={i} style={[styles.skeletonRow, i > 0 && styles.skeletonBorder]}>
                  <SkeletonCard height={40} borderRadius={12} style={{ width: 40, flexShrink: 0 }} />
                  <View style={{ flex: 1, gap: 8, paddingLeft: 4 }}>
                    <SkeletonCard height={14} borderRadius={4} style={{ width: '50%' }} />
                    <SkeletonCard height={10} borderRadius={4} style={{ width: '30%' }} />
                  </View>
                </View>
              ))}
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people" size={28} color={colors.textDim} />
              </View>
              <Text style={styles.emptyTitle}>No groups yet</Text>
              <Text style={styles.emptySubtitle}>Create a group to play with your regular crew</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CreateGroup')}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={colors.background} />
                <Text style={styles.emptyBtnText}>Create Group</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              {groups.slice(0, 3).map((g, i) => (
                <GroupListItem
                  key={g.id}
                  name={g.name}
                  memberCount={g.memberCount}
                  role={g.role}
                  myGroupPL={g.myGroupPL}
                  myGroupSessions={g.myGroupSessions}
                  onPress={() => navigation.navigate('GroupDetail', { groupId: g.id, groupName: g.name })}
                  isFirst={i === 0}
                />
              ))}
              {groups.length > 3 && (
                <TouchableOpacity
                  style={[styles.moreRow]}
                  onPress={() => navigation.navigate('GroupsList')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moreText}>+{groups.length - 3} more groups</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ── Group Activity ── */}
        {crossGroupActivity.length > 0 && (() => {
          const items = crossGroupActivity.slice(0, 8);
          const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
          const weekAgo = todayStart - 6 * 24 * 60 * 60 * 1000;
          const buckets: Array<{ label: string; data: typeof items }> = [
            { label: 'TODAY',     data: items.filter(x => new Date(x.createdAt).getTime() >= todayStart) },
            { label: 'THIS WEEK', data: items.filter(x => { const t = new Date(x.createdAt).getTime(); return t >= weekAgo && t < todayStart; }) },
            { label: 'EARLIER',   data: items.filter(x => new Date(x.createdAt).getTime() < weekAgo) },
          ].filter(b => b.data.length > 0);

          return (
            <View style={[styles.section, styles.lastSection]}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
              </View>
              <View style={{ gap: 12 }}>
                {buckets.map(bucket => (
                  <View key={bucket.label}>
                    <Text style={styles.activityBucketLabel}>{bucket.label}</Text>
                    <View style={styles.card}>
                      {bucket.data.map((item, i) => {
                        const cfg = ACTIVITY_ICON_CFG[item.type] ?? ACTIVITY_ICON_CFG._default;
                        const sessionId = item.relatedSessionId;
                        const onPress = sessionId
                          ? () => navigation.navigate('Session', { sessionId, groupId: item.groupId ?? '' })
                          : () => navigation.navigate('GroupDetail', { groupId: item.groupId, groupName: item.groupName });
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.activityRow, i > 0 && styles.activityBorder]}
                            onPress={onPress}
                            activeOpacity={0.7}
                          >
                            <Avatar name={item.actorName} size={28} />
                            <View style={[styles.activityIcon, { backgroundColor: cfg.bg }]}>
                              <Ionicons name={cfg.icon} size={15} color={cfg.color} />
                            </View>
                            <View style={styles.activityContent}>
                              <Text style={styles.activityDesc} numberOfLines={1}>{item.description}</Text>
                              <View style={styles.activityMeta}>
                                <Text style={styles.activityGroup}>{item.groupName}</Text>
                                <Text style={styles.activityDot}>·</Text>
                                <Text style={styles.activityTime}>{timeAgo(item.createdAt)}</Text>
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

      </Animated.View>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 120 },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // ── Brand lockup (logo + wordmark) ──
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  brandLogoRing: {
    width: 38,
    height: 38,
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.goldMuted,
    backgroundColor: colors.goldFaint,
  },
  brandLogo: { width: 38, height: 38, borderRadius: 11 },
  brandWordmark: { fontFamily: Sora['700'], fontSize: 18, color: colors.text, letterSpacing: 2 },

  greeting: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 3,
  },
  username: {
    ...typography.displaySerif,
    fontSize: 27,
    color: colors.text,
  },

  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    borderWidth: 1.5,
    borderColor: colors.background,
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Hero Card ───────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    marginBottom: 20,
    overflow: 'hidden',
    ...shadows.lg,
  },
  heroCardInner: {
    zIndex: 1,
  },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  heroGreeting: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 12,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroLabel: {
    ...typography.caps,
    color: colors.textMuted,
  },
  heroBadge: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  heroBadgeText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  heroValue: {
    ...typography.amountHero,
    fontSize: 48,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  heroSub: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 6,
  },
  weekChipRow: {
    marginTop: 8,
  },
  weekChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  weekChipGreen: {
    backgroundColor: 'rgba(39,174,96,0.08)',
    borderColor: 'rgba(39,174,96,0.25)',
  },
  weekChipRed: {
    backgroundColor: 'rgba(231,76,60,0.08)',
    borderColor: 'rgba(231,76,60,0.25)',
  },
  weekChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  streakEmoji: { fontSize: 14 },
  streakText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.goldLight,
  },
  heroCorner: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.goldFaint,
  },
  heroCorner2: {
    position: 'absolute',
    right: 20,
    bottom: -40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },

  // ── Live Banner ──────────────────────────────────────────────────────────
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    ...shadows.gold,
  },
  liveBannerLeft: { flex: 1, gap: 3 },
  livePillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  livePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1.5,
  },
  liveBannerName: { ...typography.h4, color: colors.text },
  liveBannerMeta: { ...typography.caption, color: colors.textMuted },

  // ── Settlements Alert ────────────────────────────────────────────────────
  settlementsAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.errorMuted,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 12,
  },
  alertIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.errorFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: { flex: 1, gap: 2 },
  alertTitle: { ...typography.labelSmall, color: colors.text },
  alertSub: { ...typography.caption, color: colors.textMuted },

  // ── Invitations Alert ────────────────────────────────────────────────────
  invitationsAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 12,
  },
  inviteIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── New Game CTA ─────────────────────────────────────────────────────────
  newGameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 12,
    ...shadows.gold,
  },
  tournamentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.goldMuted,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 32,
  },
  tournamentIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tournamentTitle: { ...typography.h4, color: colors.text },
  tournamentSub: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  drillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    // goldFaint tint (the teaser/featured treatment) — the scan reads study-then-play instead
    // of three sibling game CTAs.
    backgroundColor: colors.goldFaint,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.goldMuted,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 12,
  },
  drillIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drillTitle: { ...typography.h4, color: colors.text },
  drillSub: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  newGameLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  newGameIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(15,25,35,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newGameTitle: {
    ...typography.h4,
    color: colors.background,
  },
  newGameSub: {
    ...typography.caption,
    color: 'rgba(15,25,35,0.6)',
    marginTop: 1,
  },

  // ── Sections ─────────────────────────────────────────────────────────────
  section: { marginBottom: 28 },
  lastSection: { marginBottom: 0 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    ...typography.caps,
    color: colors.textMuted,
  },
  seeAll: {
    ...typography.caption,
    color: colors.gold,
    fontWeight: '600',
  },

  // ── Stats grid ────────────────────────────────────────────────────────────
  statsGrid: { flexDirection: 'row', gap: 10 },
  statSkeletonCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },

  // ── Card container ────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.sm,
  },

  // ── Skeleton rows ─────────────────────────────────────────────────────────
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  skeletonBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  skeletonAccent: {
    width: 3,
    height: 36,
    borderRadius: 2,
    backgroundColor: colors.border,
  },

  // ── More groups row ────────────────────────────────────────────────────────
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  moreText: { flex: 1, ...typography.bodySmall, color: colors.textMuted },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { ...typography.h4, color: colors.text },
  emptySubtitle: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  emptyBtnText: { ...typography.labelSmall, color: colors.background },

  // ── Sessions empty state ─────────────────────────────────────────────────
  sessionsEmptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 6,
  },
  sessionsEmptyTitle: { ...typography.h4, color: colors.text, marginTop: 6 },
  sessionsEmptySub: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  sessionsEmptyCta: {
    marginTop: 14,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sessionsEmptyCtaText: { ...typography.labelSmall, color: colors.background },

  // ── Top group chip ────────────────────────────────────────────────────────
  topGroupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  topGroupText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.goldLight,
    maxWidth: 200,
  },

  // ── Group Activity ────────────────────────────────────────────────────────
  activityBucketLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  activityBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  activityIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityContent: { flex: 1, gap: 3 },
  activityDesc: { ...typography.bodySmall, color: colors.text },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activityGroup: { ...typography.caption, color: colors.gold, fontWeight: '600' },
  activityDot: { ...typography.caption, color: colors.textDim },
  activityTime: { ...typography.caption, color: colors.textMuted },

  // ── Weekly Digest ─────────────────────────────────────────────────────────
  digestSkeleton: { marginBottom: spacing.xl },
  digestCard: { marginBottom: spacing.xl },
  digestTitle: {
    ...typography.displaySerif,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  digestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  digestIcon: { width: 16, textAlign: 'center' },
  digestEmoji: { fontSize: 13, width: 16, textAlign: 'center' },
  digestLabel: { ...typography.caption, color: colors.textMuted },
  digestValue: {
    ...typography.labelSmall,
    color: colors.text,
    flex: 1,
    textAlign: 'right',
  },
  digestPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  digestPromptText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.goldLight,
    flex: 1,
  },
});
