import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { durations } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

const MIN_TARGET = 44;
const PAD = spacing.xs; // inset between the track edge and the thumb

/** Clamp a (possibly out-of-range / fractional) index into [0, count-1]. */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(index) || index < 0) return 0;
  if (index > count - 1) return count - 1;
  return Math.floor(index);
}

/** Left offset (px) of the thumb for a given index and per-segment width. */
export function segmentThumbOffset(index: number, segmentWidth: number, count: number): number {
  return clampIndex(index, count) * Math.max(0, segmentWidth);
}

type Props = {
  /** Segment labels (also used as each tab's accessible name). */
  options: string[];
  /** Index of the selected segment. */
  selectedIndex: number;
  /** Fires with the pressed segment's index. */
  onChange: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  /** Accessible name for the whole control (the tablist). */
  accessibilityLabel?: string;
};

/**
 * Segmented control (period/tab picker). The shared replacement for the
 * hand-rolled segmented controls scattered across screens.
 *
 * - 44px minimum touch target per segment.
 * - Selected state uses the gold token; an animated thumb slides between
 *   segments (transform-only; instant under reduce motion).
 * - a11y: `tablist` container + `tab` segments with `accessibilityState.selected`.
 */
export default function Segmented({ options, selectedIndex, onChange, style, accessibilityLabel }: Props) {
  const reduced = useReducedMotion();
  const [trackW, setTrackW] = useState(0);

  const count = options.length;
  const selected = clampIndex(selectedIndex, count);
  const innerW = Math.max(0, trackW - PAD * 2);
  const segW = count > 0 ? innerW / count : 0;

  const tx = useSharedValue(0);

  useEffect(() => {
    const target = segmentThumbOffset(selected, segW, count);
    tx.value = reduced ? target : withTiming(target, { duration: durations.fast, easing: Easing.out(Easing.cubic) });
  }, [selected, segW, count, reduced, tx]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <View
      style={[styles.track, style]}
      onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {segW > 0 && (
        <Animated.View pointerEvents="none" style={[styles.thumb, { width: segW }, thumbStyle]} />
      )}
      {options.map((label, i) => {
        const isSelected = i === selected;
        return (
          <Pressable
            key={`${label}-${i}`}
            style={styles.segment}
            onPress={() => onChange(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={label}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: PAD,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radii.sm,
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: colors.goldMuted,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  label: { ...typography.label, color: colors.textMuted },
  labelSelected: { color: colors.gold },
});
