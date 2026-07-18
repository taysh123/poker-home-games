import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { successNotification } from '../../utils/haptics';
import LottieHost from './LottieHost';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CelebrationVariant = 'celebration' | 'achievement' | 'success';

// ── Pure variant → source map (exported for unit tests) ───────────────────────

/**
 * Maps a CelebrationVariant to its Lottie JSON asset.
 * Pure function: no React or RN dependencies — safe to unit-test in Node.
 */
export function sourceForVariant(variant: CelebrationVariant = 'celebration') {
  switch (variant) {
    case 'achievement':
      return require('../../../assets/lottie/achievement.json');
    case 'success':
      return require('../../../assets/lottie/success.json');
    case 'celebration':
    default:
      return require('../../../assets/lottie/celebration.json');
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  /**
   * Which Lottie burst to play:
   * - 'celebration' (default) — game end / winner reveal (5 s)
   * - 'achievement'           — achievement unlock modal (2 s)
   * - 'success'               — study success / retention rank-up (1.5 s)
   */
  variant?: CelebrationVariant;
  /**
   * Fire haptic success feedback on mount (default true).
   * Haptic is NOT motion — fires even under OS Reduce Motion, like PressableScale.
   */
  haptic?: boolean;
};

/**
 * Lottie-backed celebration burst overlay.
 *
 * Characteristics:
 * - Full-screen, decorative: absoluteFill, pointerEvents none, a11y-hidden.
 * - One-shot: autoPlay, loop=false. Parent controls lifetime (mount/unmount).
 * - On web OR OS Reduce Motion: poster=null → renders an invisible sized View;
 *   the moment's own UI + haptic carry it. No burst is fine — it's decorative.
 * - Haptic fires unconditionally on mount (not motion).
 *
 * Never bypass LottieHost — it enforces the web/reduced-motion fallback.
 */
export default function Celebration({ variant = 'celebration', haptic = true }: Props) {
  useEffect(() => {
    // Haptic mirrors the original Celebration behaviour: fire on mount,
    // even under Reduce Motion, because it signals state change not animation.
    if (haptic) successNotification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only; haptic prop changes mid-life are irrelevant for a burst

  return (
    // Outer View carries the a11y + interaction attributes.
    // overflow:hidden stops drifting assets from widening the page on web.
    <View
      style={[StyleSheet.absoluteFill, styles.container]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LottieHost
        source={sourceForVariant(variant)}
        autoPlay
        loop={false}
        poster={null}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
