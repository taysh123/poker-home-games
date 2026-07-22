import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { guestContinueTarget } from '../navigation/entryRouting';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useSplashDone } from '../components/brand/SplashGate';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLocalGames } from '../context/LocalGamesContext';
import { track, markSignupIntent, grantAnalyticsConsent } from '../utils/analytics';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

/**
 * Entry chooser (flag `welcome`) — the brand moment signed-out users land on after
 * the splash. Guest mode is an explicit choice, never a silent default; this screen
 * performs ZERO storage writes, so existing guests' local games are untouched and
 * "Continue as guest" resumes exactly where they left off. Signed-in users never
 * see this screen (the authed tree mounts Home directly).
 */
export default function WelcomeScreen({ navigation, route }: Props) {
  const firstRun = route.params?.firstRun === true;
  const reduced = useReducedMotion();
  const splashDone = useSplashDone();
  const { games, activeGame } = useLocalGames();
  const hasLocalGames = games.length > 0 || activeGame != null;

  useEffect(() => {
    track('welcome_shown', { firstRun });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function continueAsGuest() {
    track('welcome_guest', { firstRun, hasLocalGames });
    // The explicit choice IS the analytics consent boundary (Wave 0.2, spec decision 5) —
    // an analytics-only marker, not guest data. Anonymous device id; opt-out in Profile.
    void grantAnalyticsConsent();
    // First-run guests get the onboarding funnel; returners land on their app.
    navigation.reset({ index: 0, routes: [{ name: guestContinueTarget(!firstRun) }] });
  }

  function signIn() {
    track('welcome_signin', { firstRun });
    // Analytics-only intent marker (attribution for account_created) — not guest data.
    void markSignupIntent();
    void grantAnalyticsConsent();
    navigation.navigate('Login');
  }

  // Staggered entrance: brand → CTAs → reassurance → legal (70ms apart), held
  // until the splash overlay resolves so the choreography is actually visible.
  const group = (i: number) =>
    slideUpSequence({ reduced, delay: staggerIn(i, 70), duration: 320, play: splashDone });

  return (
    <Screen style={styles.container}>
      <View style={styles.bgDecor1} pointerEvents="none" />
      <View style={styles.bgDecor2} pointerEvents="none" />

      <View style={styles.main}>
        <MotiView {...group(0)} style={styles.brandBlock}>
          <View style={styles.logoOuter}>
            <View style={styles.logoRing}>
              <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
          </View>
          <Text style={styles.wordmark} accessibilityRole="header">T POKER</Text>
          <View style={styles.brandRule} />
          <Text style={styles.tagline}>Your home game, handled.</Text>
        </MotiView>
      </View>

      <View style={styles.footerArea}>
        <MotiView {...group(1)} style={styles.ctas}>
          <PrimaryButton
            variant="gradient"
            label="Continue as guest"
            onPress={continueAsGuest}
            accessibilityLabel="Continue as guest"
          />
          <PrimaryButton
            variant="outline"
            label="Sign in"
            onPress={signIn}
            accessibilityLabel="Sign in"
          />
        </MotiView>

        {hasLocalGames && (
          <MotiView {...group(2)}>
            <Text style={styles.reassurance}>Your games are saved on this device.</Text>
          </MotiView>
        )}

        <MotiView {...group(3)} style={styles.legal}>
          <Text style={styles.legalText}>
            A private home-game scorekeeping app for adults (18+). Not a gambling
            product — play responsibly.
          </Text>
          <Text style={styles.byline}>BY TRUE STORY LABS</Text>
        </MotiView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },

  // Ambient decor — same language as the auth screens, tokens only.
  bgDecor1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.goldFaint,
  },
  bgDecor2: {
    position: 'absolute',
    bottom: 60,
    left: -100,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.infoFaint,
    opacity: 0.35,
  },

  main: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandBlock: { alignItems: 'center' },
  logoOuter: {
    width: 100,
    height: 100,
    borderRadius: 26,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...shadows.gold,
  },
  logoRing: { width: 84, height: 84, borderRadius: 20, overflow: 'hidden' },
  logo: { width: 84, height: 84, borderRadius: 20 },
  wordmark: {
    ...typography.displaySerif,
    fontSize: 24,
    color: colors.goldLight,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  brandRule: {
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.goldMuted,
    marginBottom: spacing.lg,
  },
  tagline: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  footerArea: { gap: spacing.lg },
  ctas: { gap: spacing.md },
  reassurance: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  legal: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  legalText: {
    ...typography.caption,
    color: colors.textDim,
    lineHeight: 17,
    textAlign: 'center',
  },
  byline: {
    ...typography.caps,
    fontSize: 10,
    color: colors.goldMuted,
    letterSpacing: 1.5,
  },
});
