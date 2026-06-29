import React, { useRef } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { iconSize } from '../theme/iconSize';

/** Width of the revealed action panel in points. */
const ACTION_WIDTH = 80;

type Props = {
  children: React.ReactNode;
  /** Called when the revealed action is tapped (or a full-swipe is released). */
  onAction: () => void;
  actionLabel: string;
  actionIcon: React.ComponentProps<typeof Ionicons>['name'];
  /** Background colour of the action panel (default: colors.error). */
  actionColor?: string;
  /** When true, renders children with no swipeable wrapper. Default false. */
  disabled?: boolean;
};

/**
 * Wraps children in a swipe-left-to-reveal gesture that exposes a single
 * right-side action panel. Presentational only — callers own the action logic
 * (confirm dialogs, deletions, etc.).
 *
 * On web the swipe gesture is a progressive enhancement; the row renders and
 * taps normally regardless of platform.
 */
export default function SwipeableRow({
  children,
  onAction,
  actionLabel,
  actionIcon,
  actionColor = colors.error,
  disabled = false,
}: Props) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  // When disabled, render children transparently — no gesture surface at all.
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderRightActions={(_progress, _translation, methods) => (
        <Pressable
          style={[styles.action, { backgroundColor: actionColor }]}
          onPress={() => {
            // Close the swipeable first so the panel animates away while the
            // caller's confirm dialog (or other handler) is shown.
            methods.close();
            onAction();
          }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Ionicons name={actionIcon} size={iconSize.sm} color={colors.text} />
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      )}
      // Snap open when swipe crosses half the panel width; no over-pull.
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      // Full swipe past the threshold snaps the panel open; trigger the action
      // so the gesture alone is sufficient (same close-first pattern as tap).
      onSwipeableOpen={(direction) => {
        if (direction === 'right') {
          swipeableRef.current?.close();
          onAction();
        }
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionLabel: {
    ...typography.labelSmall,
    color: colors.text,
  },
});
