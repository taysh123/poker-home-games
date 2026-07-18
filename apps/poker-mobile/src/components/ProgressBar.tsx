import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { durations } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

const TRACK_HEIGHT = 8;
const INDETERMINATE_FRACTION = 0.35;

/** Clamp a progress value into the inclusive [0, 1] range (NaN/undefined → 0). */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

type Props = {
  /** Determinate progress, 0..1 (clamped). Ignored when `indeterminate`. */
  value?: number;
  /** Indeterminate (looping) variant — use when progress is unknown. */
  indeterminate?: boolean;
  /** Track thickness in px. Default 8. */
  height?: number;
  trackColor?: string;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
  /** Accessible name. Defaults to "Progress" / "Loading". */
  accessibilityLabel?: string;
};

/**
 * Determinate + indeterminate progress bar.
 *
 * - Fill is animated with transform only (scaleX anchored to the left edge via a
 *   measured-width translate — no layout-shifting width animation).
 * - Reduced motion: determinate snaps to the value instantly; indeterminate
 *   shows a single static centered segment (no loop).
 * - a11y: `accessibilityRole="progressbar"` with `accessibilityValue` (0–100)
 *   for the determinate variant.
 */
export default function ProgressBar({
  value = 0,
  indeterminate = false,
  height = TRACK_HEIGHT,
  trackColor = colors.surfaceHigh,
  fillColor = colors.gold,
  style,
  accessibilityLabel,
}: Props) {
  const reduced = useReducedMotion();
  const trackW = useSharedValue(0);
  const progress = useSharedValue(clampProgress(value));
  const sweep = useSharedValue(0);

  const pct = clampProgress(value);

  // Determinate — ease the fill toward the new value (instant under reduce motion).
  useEffect(() => {
    if (indeterminate) return;
    const target = clampProgress(value);
    progress.value = reduced
      ? target
      : withTiming(target, { duration: durations.normal, easing: Easing.out(Easing.cubic) });
  }, [value, indeterminate, reduced, progress]);

  // Indeterminate — loop a segment across the track; static & centered under reduce motion.
  useEffect(() => {
    if (!indeterminate) return;
    if (reduced) {
      cancelAnimation(sweep);
      sweep.value = 0.5;
      return;
    }
    sweep.value = 0;
    sweep.value = withRepeat(
      withTiming(1, { duration: durations.slower * 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(sweep);
  }, [indeterminate, reduced, sweep]);

  const determinateStyle = useAnimatedStyle(() => {
    const w = trackW.value;
    const p = progress.value;
    // Anchor scaleX to the LEFT edge without transformOrigin (web-safe): a
    // center-scaled bar's left edge sits at w*(1-p)/2 — translate it back to 0.
    return { transform: [{ translateX: -(w * (1 - p)) / 2 }, { scaleX: p }] };
  });

  const indeterminateStyle = useAnimatedStyle(() => {
    const w = trackW.value;
    const seg = w * INDETERMINATE_FRACTION;
    return { transform: [{ translateX: -seg + sweep.value * (w + seg) }] };
  });

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }, style]}
      onLayout={e => {
        trackW.value = e.nativeEvent.layout.width;
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? (indeterminate ? 'Loading' : 'Progress')}
      accessibilityValue={indeterminate ? undefined : { min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      {indeterminate ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segment,
            { borderRadius: height / 2, backgroundColor: fillColor },
            indeterminateStyle,
          ]}
        />
      ) : (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: height / 2, backgroundColor: fillColor },
            determinateStyle,
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  segment: { position: 'absolute', left: 0, top: 0, bottom: 0, width: `${INDETERMINATE_FRACTION * 100}%` },
});
