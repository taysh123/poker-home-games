import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Reanimated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import BrandLockup from './BrandLockup';
import { typography } from '../../theme/typography';
import { useReducedMotionState } from '../../hooks/useReducedMotion';
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


type Props = {
  /** Overlay finished and may unmount (end of the fade). */
  onDone: () => void;
  /** The exit fade has STARTED — release the SplashGate here so the screen underneath rises
   * THROUGH the dissolve instead of appearing after it. Before Q1.2 the gate opened with
   * `onDone`, so the last ~300ms revealed an empty screen. Fires at most once, and on skip too. */
  onReveal?: () => void;
};

export default function BrandSplash({ onDone, onReveal }: Props) {
  // Hold the opening frames until the OS setting is actually READ — the async probe used to
  // let a reduce-motion user see the animation start before it snapped to the static frame
  // (Q1.2 substrate: an accessibility defect). `ready` is synchronous on web.
  const { reduced, ready: motionReady } = useReducedMotionState();

  const rootOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.92);
  const wordOpacity = useSharedValue(0);
  const wordRise = useSharedValue(8);
  const tagOpacity = useSharedValue(0);

  const doneRef = useRef(false);
  const revealedRef = useRef(false);
  // Set the moment the exit fade engages (scheduled exit or tap-to-skip). From then
  // on, taps are no-ops (a tap during the fade must never EXTEND the splash) and a
  // late reduce-motion re-arm lands the fade instead of snapping back to opacity 1.
  const exitStartedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /** Open the gate exactly once, the moment the overlay starts dissolving. */
  function reveal() {
    if (revealedRef.current) return;
    revealedRef.current = true;
    onReveal?.();
  }

  function finish() {
    if (doneRef.current) return;
    reveal(); // reduced-motion / skip paths finish without a fade — never strand the gate
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
    if (doneRef.current) return;
    // Nothing starts (and nothing is visible to animate) until we know the preference.
    if (!motionReady) return;
    if (exitStartedRef.current) {
      // The exit fade (or a skip) is already in flight — never revert it; just
      // land the overlay on the short clock.
      schedule(finish, SPLASH.SKIP_EXIT);
      return () => timersRef.current.forEach(clearTimeout);
    }
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

    // Deliberate curves (Q1.2): things ARRIVING decelerate (ease-out); the overlay LEAVING
    // accelerates away (ease-in). Everything previously rode Reanimated's default in-out,
    // which reads soft at both ends.
    const arrive = { easing: Easing.out(Easing.cubic) };
    const depart = { easing: Easing.in(Easing.cubic) };
    logoOpacity.value = withTiming(1, { duration: SPLASH.LOGO_IN, ...arrive });
    logoScale.value = withSpring(1, { damping: 16, stiffness: 190 });
    wordOpacity.value = withDelay(SPLASH.WORD_DELAY, withTiming(1, { duration: SPLASH.WORD_IN, ...arrive }));
    wordRise.value = withDelay(SPLASH.WORD_DELAY, withTiming(0, { duration: SPLASH.WORD_IN, ...arrive }));
    tagOpacity.value = withDelay(SPLASH.TAG_DELAY, withTiming(0.9, { duration: SPLASH.TAG_IN, ...arrive }));
    // Exit: the overlay fades itself out, revealing the app already rising underneath.
    rootOpacity.value = withDelay(SPLASH.EXIT_AT, withTiming(0, { duration: SPLASH.EXIT, ...depart }));
    schedule(() => { exitStartedRef.current = true; reveal(); }, SPLASH.EXIT_AT);
    schedule(finish, SPLASH.TOTAL);

    return () => timersRef.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, motionReady]);

  function skip() {
    // Already exiting (scheduled fade or a previous tap) — ignore; a tap during
    // the fade must shorten nothing and extend nothing.
    if (doneRef.current || exitStartedRef.current) return;
    exitStartedRef.current = true;
    reveal();
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
        {/* ONE lockup, shared with Welcome (BrandLockup) — the parts are still animated
            individually via the render slots, so the choreography is unchanged. */}
        <BrandLockup
          scale="splash"
          footer="tagline"
          renderBadge={badge => <Reanimated.View style={logoStyle}>{badge}</Reanimated.View>}
          renderWordmark={word => <Reanimated.View style={wordStyle}>{word}</Reanimated.View>}
          renderFooter={tag => <Reanimated.View style={tagStyle}>{tag}</Reanimated.View>}
        />
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
  bylineWrap: { position: 'absolute', bottom: 56, alignSelf: 'center' },
  byline: {
    ...typography.caps,
    fontSize: 10,
    color: colors.goldMuted,
    letterSpacing: 1.5,
    opacity: 0.7,
  },
});
