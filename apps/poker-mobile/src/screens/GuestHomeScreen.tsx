import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
} from 'react-native';
import PressableScale from '../components/motion/PressableScale';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import { RootStackParamList } from '../navigation/AppNavigator';
import SessionListItem from '../components/SessionListItem';
import SectionTitle from '../components/SectionTitle';
import Screen from '../components/Screen';
import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useSplashDone } from '../components/brand/SplashGate';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLocalGames } from '../context/LocalGamesContext';
import { gameResult } from '../local/localStats';
import { formatCents } from '../utils/money';
import { timeAgo } from '../utils/formatters';
import { markSignupIntent } from '../utils/analytics';
import { usePersona } from '../features/persona/state/PersonaContext';
import { heroVariantForGoal, drillCardSub } from '../features/persona/logic/recommendations';
import { useStudy } from '../features/study/state/StudyContext';
import { isFeatureEnabled } from '../config/features';

/** Time-of-day salutation (local clock; display-only). */
function greetingWord(hour = new Date().getHours()): string {
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Home tab for guests (no account): start/resume local games, sign-in upsell. */
export default function GuestHomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const splashDone = useSplashDone();
  const { games, activeGame } = useLocalGames();
  const { persona } = usePersona();
  const { limitFor } = useStudy();
  const greetName = persona?.displayName ?? null;
  // The drill hero is honest against the SHARED daily pool: sub reflects what's actually left,
  // and a spent pool hides the card entirely (no dead-end tap into the limit nudge).
  const drillSub = drillCardSub(limitFor('practiceQuestion').remaining);
  const showDrill =
    heroVariantForGoal(persona?.goal ?? null) === 'improver' &&
    isFeatureEnabled('study') &&
    drillSub !== null;

  const recentFinished = games.filter(g => g.status === 'Finished').slice(0, 5);

  // One-time mount stagger: brand header → hero/active card → recent rows → upsell,
  // held until the splash resolves (legacy welcome-off path cold-starts here). Tab
  // screens stay mounted, so focus changes never re-trigger this (mount-once).
  const entrance = (i: number) =>
    slideUpSequence({ reduced, delay: staggerIn(i, 70), duration: 320, play: splashDone });

  return (
    <Screen>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.huge * 2 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Brand header */}
      <MotiView {...entrance(0)} style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <View style={styles.logoBadge}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brand}>T POKER</Text>
            <Text style={styles.tagline}>Your home game, handled.</Text>
          </View>
        </View>
        <PressableScale
          style={styles.signInBtn}
          onPress={() => navigation.navigate('Login')}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <Text style={styles.signInBtnText}>Sign In</Text>
        </PressableScale>
      </MotiView>

      {/* Active game */}
      {activeGame && (
        <MotiView {...entrance(1)}>
        <PressableScale
          style={styles.activeCard}
          onPress={() => navigation.navigate('LocalSession', { gameId: activeGame.id })}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={`Resume live game ${activeGame.name}`}
        >
          <View style={styles.activeDotWrap}>
            <View style={styles.activeDot} />
          </View>
          <View style={styles.activeInfo}>
            <Text style={styles.activeName} numberOfLines={1}>{activeGame.name}</Text>
            <Text style={styles.activeMeta}>
              Live · {activeGame.players.length} players · started {timeAgo(activeGame.createdAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.gold} />
        </PressableScale>
        </MotiView>
      )}

      {/* Hero — goal-led (1.3): improvers get today's drill first; hosts get the game cards. */}
      {!activeGame && (
        <MotiView {...entrance(1)} style={styles.heroSection}>
          {!!greetName && (
            <Text style={styles.greeting}>{`${greetingWord()}, ${greetName}.`}</Text>
          )}
          {showDrill && (
            <PressableScale
              style={styles.drillCard}
              onPress={() => navigation.navigate('StudyTrainer', { mode: 'spot' })}
              haptic="medium"
              accessibilityRole="button"
              accessibilityLabel={`Today's drill. ${drillSub}.`}
            >
              <View style={styles.drillIconWrap}>
                <Ionicons name="flash" size={iconSize.sm} color={colors.background} />
              </View>
              <View style={styles.drillText}>
                <Text style={styles.drillTitle}>Today's drill</Text>
                <Text style={styles.drillSub}>{drillSub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.gold} />
            </PressableScale>
          )}
          <Text style={styles.heroLead}>
            {showDrill
              ? 'Or keep score for tonight’s game.'
              : 'Set up tonight’s game — no account needed.'}
          </Text>
          <View style={styles.heroRow}>
            <PressableScale
              style={styles.heroCard}
              onPress={() => navigation.navigate('LocalNewGame', { mode: 'cash' })}
              haptic="medium"
              accessibilityRole="button"
              accessibilityLabel="Start a cash game. Buy-ins, cash-outs, settle up."
            >
              {/* A ledger glyph, not a ▶ play button: this opens a scoresheet, it does not
                  start a game of poker (store-classification principle). */}
              <View style={styles.heroIconWrap}>
                <Ionicons name="clipboard-outline" size={iconSize.sm} color={colors.background} />
              </View>
              <Text style={styles.heroTitle}>Cash Game</Text>
              <Text style={styles.heroSubtitle}>Buy-ins, cash-outs, settle up</Text>
            </PressableScale>
            <PressableScale
              style={styles.heroCard}
              onPress={() => navigation.navigate('LocalNewGame', { mode: 'tournament' })}
              haptic="medium"
              accessibilityRole="button"
              accessibilityLabel="Start a tournament. Blind clock, buy-in tracking, podium."
            >
              <View style={[styles.heroIconWrap, styles.heroIconWrapAlt]}>
                <Ionicons name="trophy" size={iconSize.sm} color={colors.gold} />
              </View>
              <Text style={styles.heroTitle}>Tournament</Text>
              <Text style={styles.heroSubtitle}>Blind clock, buy-in tracking, podium</Text>
            </PressableScale>
          </View>
        </MotiView>
      )}

      {/* Recent local games */}
      {recentFinished.length > 0 && (
        <View style={styles.section}>
          <SectionTitle>RECENT GAMES</SectionTitle>
          <View style={styles.sectionCard}>
            {recentFinished.map((game, i) => {
              const result = gameResult(game);
              return (
                <MotiView key={game.id} {...slideUpSequence({ reduced, delay: staggerIn(i, 40, 140), play: splashDone })}>
                  <SessionListItem
                    name={game.name}
                    meta={`${result.playerCount} players · ${formatCents(result.totalPotCents)} total · ${timeAgo(result.endedAt)}`}
                    onPress={() => navigation.navigate('LocalSessionSummary', { gameId: game.id })}
                    isFirst={i === 0}
                  />
                </MotiView>
              );
            })}
          </View>
        </View>
      )}

      {/* Sign-in upsell — contextual account creation (value already shown) */}
      <MotiView {...entrance(4)}>
      <PressableScale
        style={styles.upsellCard}
        onPress={() => { markSignupIntent(); navigation.navigate('Login'); }}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel="Make it official. Create a free account for groups, lifetime stats, leaderboards, and game history across devices."
      >
        <View style={styles.upsellIconWrap}>
          <Ionicons name="cloud-upload-outline" size={iconSize.sm} color={colors.gold} />
        </View>
        <View style={styles.upsellText}>
          <Text style={styles.upsellTitle}>Make it official</Text>
          <Text style={styles.upsellSubtitle}>
            Create a free account for groups, lifetime stats, leaderboards, and game history across devices.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={iconSize.xs} color={colors.textMuted} />
      </PressableScale>
      </MotiView>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  logoBadge: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: 38, height: 38 },
  brandText: { flexShrink: 1 },
  brand: { ...typography.displaySerif, fontSize: 27, color: colors.text, letterSpacing: 2.5 },
  tagline: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },
  signInBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 1,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  signInBtnText: { ...typography.labelSmall, color: colors.gold },

  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.gold,
    gap: spacing.md,
    ...shadows.goldSm,
  },
  activeDotWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  activeInfo: { flex: 1, gap: 2 },
  activeName: { ...typography.label, color: colors.text },
  activeMeta: { ...typography.caption, color: colors.textMuted },

  heroSection: { gap: spacing.sm },
  heroLead: { ...typography.bodySmall, color: colors.textMuted },
  greeting: { ...typography.displaySerif, fontSize: 22, lineHeight: 28, color: colors.text, marginBottom: spacing.xs },
  drillCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    // goldFaint tint = the established "today's featured action" treatment — reads as the hero,
    // distinct from the plain-surface game cards below it.
    backgroundColor: colors.goldFaint, borderWidth: 1, borderColor: colors.goldMuted,
    borderRadius: radii.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 72,
    ...shadows.md,
  },
  drillIconWrap: {
    width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  drillText: { flex: 1, gap: 2 },
  drillTitle: { ...typography.label, color: colors.text },
  drillSub: { ...typography.bodySmall, color: colors.textMuted },
  heroRow: { flexDirection: 'row', gap: spacing.md },
  heroCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    gap: spacing.sm - 1,
    ...shadows.goldSm,
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  heroIconWrapAlt: {
    backgroundColor: colors.goldFaint,
    borderWidth: 1.5,
    borderColor: colors.goldMuted,
  },
  playGlyph: { marginLeft: 2 },
  heroTitle: { ...typography.h3, color: colors.text },
  heroSubtitle: { ...typography.caption, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },

  section: { gap: spacing.sm },
  sectionCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  upsellIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.control,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellText: { flex: 1, gap: 3 },
  upsellTitle: { ...typography.label, color: colors.text },
  upsellSubtitle: { ...typography.caption, color: colors.textMuted, lineHeight: 17 },
});
