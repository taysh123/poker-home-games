import React, { useEffect, useRef, useState } from 'react';
import { Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { typography } from '../theme/typography';
import { zIndex } from '../theme/zIndex';
import { durations } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional heading rendered under the drag handle. */
  title?: string;
  /** Show the grab handle. Default true. */
  showHandle?: boolean;
};

const OPEN_MS = durations.normal;
const CLOSE_MS = durations.fast;

/**
 * Reusable bottom sheet — the shared primitive generalizing the ActionSheet /
 * DetailSheet pattern for future screens.
 *
 * - Slide-up content + independent backdrop fade. Reduced motion → instant, no
 *   slide/fade. The sheet stays mounted through its exit animation, then unmounts.
 * - Safe-area bottom padding; tokenized radii / shadows / z-index.
 * - a11y: `accessibilityViewIsModal`; backdrop is a labelled dismiss button.
 */
export default function BottomSheet({ visible, onClose, children, title, showHandle = true }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(0);
  const backdrop = useSharedValue(0);
  const hiddenOffset = useRef(800); // updated from the measured sheet height

  // Mount as soon as we should be visible (exit handled below).
  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  // Drive open / close once mounted.
  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      if (reduced) {
        translateY.value = 0;
        backdrop.value = 1;
      } else {
        translateY.value = hiddenOffset.current;
        translateY.value = withTiming(0, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
        backdrop.value = withTiming(1, { duration: OPEN_MS });
      }
    } else if (reduced) {
      setMounted(false);
    } else {
      backdrop.value = withTiming(0, { duration: CLOSE_MS });
      translateY.value = withTiming(
        hiddenOffset.current,
        { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) },
        finished => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
  }, [mounted, visible, reduced, translateY, backdrop]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <RNModal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }, sheetStyle]}
          onLayout={e => {
            hiddenOffset.current = e.nativeEvent.layout.height + insets.bottom + spacing.huge;
          }}
          accessibilityViewIsModal
        >
          {showHandle && <View style={styles.handle} />}
          {title ? (
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', zIndex: zIndex.modal },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bgOverlay,
    zIndex: zIndex.overlay,
  },
  sheet: {
    backgroundColor: colors.surfaceHigh,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '90%',
    zIndex: zIndex.modal,
    ...shadows.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
});
