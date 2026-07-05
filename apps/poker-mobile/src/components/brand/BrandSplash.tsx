import React, { useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import Reanimated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { SPLASH } from './splashTimeline';

/**
 * Branded launch splash (~1.2s, flag `v2Splash`): logo badge springs in, the
 * "T POKER" wordmark rises beneath it, the tagline breathes in, then the whole
 * overlay fades out revealing the app already mounted underneath.
 *
 * - Rendered as a full-screen overlay above the navigator in App.tsx.
 * - Code-driven only (shared-value opacity/translate/scale) — identical motion
 *   on native AND web; no Lottie, no layout animations.
 * - Always skippable: tap anywhere ("Skip intro").
 * - OS Reduce Motion: a static composed frame for SPLASH.REDUCED_HOLD, no fades.
 * - The background matches the native OS splash color (backgroundDeep) so the
 *   OS splash → this overlay handoff is seamless.
 */

const TPOKER_LOGO = require('../../../assets/logo.png');

type Props = { onDone: () => void };

export default function BrandSplash({ onDone }: Props) {
  const reduced = useReducedMotion();

  const rootOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.92);
  const wordOpacity = useSharedValue(0);
  const wordRise = useSharedValue(8);
  const tagOpacity = useSharedValue(0);

  const doneRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    onDone();
  }

  function schedule(fn: () => void, ms: number) {
    timersRef.current.push(setTimeout(fn, ms));
  }

  useEffect(() => {
    // Re-arms if the OS reduce-motion setting resolves/changes mid-splash:
    // the choreography snaps to the static frame and finishes on the short clock.
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    [rootOpacity, logoOpacity, logoScale, wordOpacity, wordRise, tagOpacity].forEach(cancelAnimation);

    if (reduced) {
      rootOpacity.value = 1;
      logoOpacity.value = 1;
      logoScale.value = 1;
      wordOpacity.value = 1;
      wordRise.value = 0;
      tagOpacity.value = 0.9;
      schedule(finish, SPLASH.REDUCED_HOLD);
      return () => timersRef.current.forEach(clearTimeout);
    }

    logoOpacity.value = withTiming(1, { duration: SPLASH.LOGO_IN });
    logoScale.value = withSpring(1, { damping: 16, stiffness: 190 });
    wordOpacity.value = withDelay(SPLASH.WORD_DELAY, withTiming(1, { duration: SPLASH.WORD_IN }));
    wordRise.value = withDelay(SPLASH.WORD_DELAY, withTiming(0, { duration: SPLASH.WORD_IN }));
    tagOpacity.value = withDelay(SPLASH.TAG_DELAY, withTiming(0.9, { duration: SPLASH.TAG_IN }));
    // Exit: the overlay fades itself out, revealing the app underneath.
    rootOpacity.value = withDelay(SPLASH.EXIT_AT, withTiming(0, { duration: SPLASH.EXIT }));
    schedule(finish, SPLASH.TOTAL);

    return () => timersRef.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  function skip() {
    if (doneRef.current) return;
    if (reduced) {
      finish();
      return;
    }
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    rootOpacity.value = withTiming(0, { duration: SPLASH.SKIP_EXIT });
    schedule(finish, SPLASH.SKIP_EXIT);
  }

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordRise.value }],
  }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tagOpacity.value }));

  return (
    <Reanimated.View style={[styles.root, rootStyle]}>
      <Pressable
        style={styles.fill}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
      >
        <Reanimated.View style={logoStyle}>
          <Image source={TPOKER_LOGO} style={styles.logo} resizeMode="contain" />
        </Reanimated.View>
        <Reanimated.View style={wordStyle}>
          <Text style={styles.wordmark}>T POKER</Text>
        </Reanimated.View>
        <Reanimated.View style={tagStyle}>
          <Text style={styles.tagline}>YOUR HOME GAME, HANDLED</Text>
        </Reanimated.View>
        <Reanimated.View style={[styles.bylineWrap, tagStyle]} pointerEvents="none">
          <Text style={styles.byline}>BY TRUE STORY LABS</Text>
        </Reanimated.View>
      </Pressable>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundDeep,
    zIndex: 1000,
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 148, height: 148 },
  wordmark: {
    ...typography.displaySerif,
    fontSize: 26,
    color: colors.goldLight,
    letterSpacing: 4,
    marginTop: 18,
  },
  tagline: {
    ...typography.caps,
    color: colors.goldMuted,
    letterSpacing: 2.5,
    marginTop: 8,
  },
  bylineWrap: { position: 'absolute', bottom: 56, alignSelf: 'center' },
  byline: {
    ...typography.caps,
    fontSize: 10,
    color: colors.goldMuted,
    letterSpacing: 1.5,
    opacity: 0.7,
  },
});
