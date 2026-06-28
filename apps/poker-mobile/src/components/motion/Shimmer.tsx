import React, { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const BAND_WIDTH = 160;

type Props = {
  /** Width of the area being shimmered — drives the sweep distance. */
  width?: number;
};

/**
 * Sweeping highlight band for skeleton placeholders. Parent must set
 * overflow: 'hidden'. On web falls back to an opacity pulse (gradient
 * translate loops are unreliable on react-native-web).
 *
 * Reduced motion: the loop never starts and a single static highlight is
 * rendered instead — the skeleton still reads as a placeholder without pulsing.
 */
export default function Shimmer({ width = 400 }: Props) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      // Reduce Motion: hold a static frame, never loop.
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress, reduced]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -BAND_WIDTH + progress.value * (width + BAND_WIDTH) }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + Math.sin(progress.value * Math.PI) * 0.45,
  }));

  if (reduced) {
    // Static highlight — no animated style, no loop (accessibility: reduce motion).
    return <Animated.View style={[StyleSheet.absoluteFillObject, styles.webPulse]} pointerEvents="none" />;
  }

  if (Platform.OS === 'web') {
    return <Animated.View style={[StyleSheet.absoluteFillObject, styles.webPulse, pulseStyle]} />;
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, sweepStyle]} pointerEvents="none">
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width: BAND_WIDTH, height: '100%' }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  webPulse: { backgroundColor: 'rgba(255,255,255,0.06)' },
});
