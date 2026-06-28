import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
  /** Optional heading rendered at the top of the dialog. */
  title?: string;
};

/**
 * Generic centered modal dialog (backdrop + card). The counterpart to
 * `BottomSheet` — use this for confirmations and focused content, not menus.
 *
 * - Backdrop press closes; `onRequestClose` (Android back) closes.
 * - Motion: native fade + a subtle scale-in. Reduced motion → no animation.
 * - a11y: `accessibilityViewIsModal` isolates the dialog for VoiceOver, and
 *   screen-reader focus is moved into the card on open.
 */
export default function Modal({ visible, onClose, children, title }: Props) {
  const reduced = useReducedMotion();
  const cardRef = useRef<View>(null);
  const scale = useSharedValue(reduced ? 1 : 0.96);

  useEffect(() => {
    if (visible) {
      scale.value = reduced ? 1 : withTiming(1, { duration: durations.fast });
      const t = setTimeout(() => {
        const node = findNodeHandle(cardRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus?.(node);
      }, 60);
      return () => clearTimeout(t);
    }
    // Reset so the next open re-animates from small.
    if (!reduced) scale.value = 0.96;
  }, [visible, reduced, scale]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
        />
        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <View ref={cardRef} style={styles.card} accessible={false}>
            {title ? (
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
            ) : null}
            {children}
          </View>
        </Animated.View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: zIndex.modal,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bgOverlay,
    zIndex: zIndex.overlay,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 420,
    zIndex: zIndex.modal,
  },
  card: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.xl,
  },
  title: { ...typography.h3, color: colors.text },
});
