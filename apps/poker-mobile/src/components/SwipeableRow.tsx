import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { iconSize } from '../theme/iconSize';

/** Width of the revealed action panel in points. */
const ACTION_WIDTH = 80;

type Props = {
  children: React.ReactNode;
  /** Called when the revealed action button is tapped. */
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
 * Reveal-then-tap: a swipe reveals the action button (which stays open) and the
 * user taps it to fire `onAction`. That deliberate second step deliberately
 * suits destructive actions — a stray or shallow swipe never triggers anything
 * on its own; the button must be seen and tapped. On web the gesture is a
 * progressive enhancement; the row renders and taps normally regardless.
 */
export default function SwipeableRow({
  children,
  onAction,
  actionLabel,
  actionIcon,
  actionColor = colors.error,
  disabled = false,
}: Props) {
  // When disabled, render children transparently — no gesture surface at all.
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <ReanimatedSwipeable
      renderRightActions={(_progress, _translation, methods) => (
        <Pressable
          style={[styles.action, { backgroundColor: actionColor }]}
          onPress={() => {
            // Close the panel so it animates away while the caller's handler
            // (e.g. a confirm dialog) takes over.
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
      // Snap the panel fully open once the swipe crosses half its width; the user
      // then taps the revealed button. No auto-trigger on open, no over-pull —
      // a deliberate tap is required, which is the right safeguard for a
      // destructive action.
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
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
