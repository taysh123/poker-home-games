import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import Screen from '../components/Screen';
import PressableScale from '../components/motion/PressableScale';
import * as storage from '../utils/storage';
import { track, markSignupIntent } from '../utils/analytics';
import { isFeatureEnabled } from '../config/features';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const { width } = Dimensions.get('window');

/** The four pillars — pillar-led onboarding (Play → Track → Study → Improve). */
const PILLARS: { icon: IoniconsName; title: string; subtitle: string }[] = [
  { icon: 'play-circle', title: 'Play', subtitle: 'Run the night — cash games & tournaments with a blind clock. Settle up in one tap.' },
  { icon: 'wallet',      title: 'Track', subtitle: 'Know your bankroll — every session, ROI, and win rate. Your real numbers, not vibes.' },
  { icon: 'school',      title: 'Study', subtitle: 'Sharpen your game — daily preflop drills, streaks, and a growing range library.' },
  { icon: 'sparkles',    title: 'Improve', subtitle: 'Get an AI read — paste a hand, get clear coaching. Your first analysis is on us.' },
];

type ActionKey = 'play' | 'track' | 'study' | 'improve';

function Dot({ active }: { active: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withSpring(active ? 24 : 8, { damping: 18, stiffness: 220 }),
    opacity: withTiming(active ? 1 : 0.7, { duration: 200 }),
  }));
  return <Animated.View style={[styles.dot, active && styles.dotActive, style]} />;
}

/**
 * V2.1 onboarding — introduces all four pillars, then drops the user into a REAL action
 * (account-free) via a starting-point router. Account creation is contextual + later (the
 * Improve teaser + the existing guest upsells). Gated behind the `onboardingV2` flag.
 */
export default function OnboardingV2Screen({ navigation }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'slides' | 'router'>('slides');

  useEffect(() => {
    track('onboarding_started');
  }, []);

  async function markSeen() {
    try { await storage.setItemAsync('hasSeenOnboarding', 'true'); } catch { /* best-effort */ }
  }

  function goNext() {
    if (index < PILLARS.length - 1) {
      const next = index + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    } else {
      setPhase('router');
    }
  }

  async function skip() {
    track('onboarding_skipped', { from: phase });
    await markSeen();
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  }

  // Enter a real action: record the funnel, mark onboarding done, and reset the stack so
  // the chosen flow sits above Home (back returns to Home, not onboarding).
  async function enterAction(action: ActionKey, target: keyof RootStackParamList, params?: object) {
    track('onboarding_completed', { via: action });
    track('first_action_completed', { action });
    await markSeen();
    navigation.reset({
      index: 1,
      routes: [{ name: 'MainTabs' }, { name: target as any, params: params as any }],
    });
  }

  async function chooseImprove() {
    // Improve needs an account (no anonymous AI) — this is the contextual signup path.
    track('onboarding_completed', { via: 'improve' });
    await markSignupIntent();
    await markSeen();
    navigation.reset({ index: 1, routes: [{ name: 'MainTabs' }, { name: 'Login' }] });
  }

  const actions: { key: ActionKey; icon: IoniconsName; title: string; sub: string; onPress: () => void; show: boolean; teaser?: boolean }[] = [
    {
      key: 'play', icon: 'play', title: 'Start a game', sub: 'Deal in your crew right now',
      onPress: () => enterAction('play', 'LocalNewGame', { mode: 'cash' }), show: true,
    },
    {
      key: 'track', icon: 'wallet-outline', title: 'Log a session', sub: 'Add a game you already played',
      onPress: () => enterAction('track', 'LogSession'), show: isFeatureEnabled('bankroll'),
    },
    {
      key: 'study', icon: 'school-outline', title: 'Drill a spot', sub: 'Quick preflop reps',
      onPress: () => enterAction('study', 'StudyTrainer', { mode: 'spot' }), show: isFeatureEnabled('study'),
    },
    {
      key: 'improve', icon: 'sparkles', title: 'Try the AI Coach', sub: 'Free with an account',
      onPress: chooseImprove, show: isFeatureEnabled('coach'), teaser: true,
    },
  ];

  return (
    <Screen style={styles.container}>
      {/* Brand mark */}
      <View style={styles.brandRow}>
        <View style={styles.brandLogoRing}>
          <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
        </View>
        <Text style={styles.brandName}>T POKER</Text>
      </View>

      {/* Skip */}
      <PressableScale
        style={styles.skipBtn}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel="Skip onboarding"
      >
        <Text style={styles.skipText}>Skip</Text>
      </PressableScale>

      {phase === 'slides' ? (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / width);
              if (i !== index && i >= 0 && i < PILLARS.length) setIndex(i);
            }}
            style={styles.slideScroll}
          >
            {PILLARS.map((p, i) => (
              <View key={p.title} style={styles.slide} accessible accessibilityLabel={`${p.title}. ${p.subtitle}`}>
                <View style={styles.iconWrap}>
                  <Ionicons name={p.icon} size={40} color={colors.gold} />
                </View>
                <Text style={styles.pillarKicker}>{`Pillar ${i + 1} of ${PILLARS.length}`}</Text>
                <Text style={styles.slideTitle}>{p.title}</Text>
                <Text style={styles.slideSubtitle}>{p.subtitle}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.dots}>
              {PILLARS.map((p, i) => <Dot key={p.title} active={i === index} />)}
            </View>
            <PressableScale
              style={styles.primaryBtn}
              onPress={goNext}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={index < PILLARS.length - 1 ? 'Next pillar' : 'Get started'}
            >
              <Text style={styles.primaryBtnText}>{index < PILLARS.length - 1 ? 'Next' : 'Get Started'}</Text>
              {index < PILLARS.length - 1 && <Ionicons name="arrow-forward" size={16} color={colors.background} />}
            </PressableScale>
          </View>
        </>
      ) : (
        // ── Starting-point router ──
        <View style={styles.routerWrap}>
          <View style={styles.routerHead}>
            <Text style={styles.routerTitle}>Where do you want to start?</Text>
            <Text style={styles.routerSub}>Jump in — no account needed.</Text>
          </View>

          <View style={styles.cards}>
            {actions.filter(a => a.show).map(a => (
              <PressableScale
                key={a.key}
                style={[styles.card, a.teaser && styles.cardTeaser]}
                onPress={a.onPress}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={`${a.title}. ${a.sub}`}
              >
                <View style={[styles.cardIcon, a.teaser && styles.cardIconTeaser]}>
                  <Ionicons name={a.icon} size={20} color={a.teaser ? colors.background : colors.gold} />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{a.title}</Text>
                  <Text style={styles.cardSub}>{a.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </PressableScale>
            ))}
          </View>

          <PressableScale
            style={styles.exploreBtn}
            onPress={skip}
            accessibilityRole="button"
            accessibilityLabel="Explore on my own"
          >
            <Text style={styles.exploreText}>I'll explore on my own</Text>
          </PressableScale>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
  },
  brandRow: { alignItems: 'center', gap: 10, paddingTop: 8 },
  brandLogoRing: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.goldMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  brandLogo: { width: 52, height: 52 },
  brandName: { ...typography.displaySerif, fontSize: 20, color: colors.goldLight, letterSpacing: 4 },

  skipBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 36, right: 24, zIndex: 10, paddingHorizontal: 12, paddingVertical: 6 },
  skipText: { ...typography.bodySmall, color: colors.textMuted, fontWeight: '600' },

  slideScroll: { flex: 1 },
  slide: { width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: spacing.md },
  iconWrap: {
    width: 96, height: 96, borderRadius: 28, backgroundColor: colors.goldFaint,
    borderWidth: 1, borderColor: colors.goldMuted, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  pillarKicker: { ...typography.caps, color: colors.gold },
  slideTitle: { ...typography.displaySerif, color: colors.text, textAlign: 'center' },
  slideSubtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },

  footer: { paddingHorizontal: 24, gap: 24, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh },
  dotActive: { width: 24, backgroundColor: colors.gold },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.gold, borderRadius: radii.lg,
    paddingHorizontal: 32, paddingVertical: 16, alignSelf: 'stretch', justifyContent: 'center', minHeight: 44,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: colors.background },

  // Router
  routerWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.xl },
  routerHead: { gap: spacing.xs, alignItems: 'center' },
  routerTitle: { ...typography.h1, color: colors.text, textAlign: 'center' },
  routerSub: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  cards: { gap: spacing.md },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 44,
  },
  cardTeaser: { borderColor: colors.goldMuted, backgroundColor: colors.goldFaint },
  cardIcon: {
    width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.goldFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  cardIconTeaser: { backgroundColor: colors.gold },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...typography.label, color: colors.text },
  cardSub: { ...typography.bodySmall, color: colors.textMuted },
  exploreBtn: { alignItems: 'center', paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  exploreText: { ...typography.label, color: colors.textMuted },
});
