import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { shadows } from '../theme/shadows';

type Variant = 'flat' | 'elevated' | 'hero';

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  /** Inner padding (default spacing.lg). Pass 0 for list-style cards. */
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Unified surface card (Velvet Table):
 * - flat:     surface + border, the everyday card
 * - elevated: raised surface + soft shadow
 * - hero:     gold hairline gradient border (1px LinearGradient frame)
 */
export default function Card({ children, variant = 'flat', padding = spacing.lg, style }: Props) {
  if (variant === 'hero') {
    return (
      <LinearGradient
        colors={[...gradients.goldShine]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroFrame, style]}
      >
        <View style={[styles.heroInner, { padding }]}>{children}</View>
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        { padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: colors.surfaceHigh,
    ...shadows.md,
  },
  heroFrame: {
    borderRadius: radii.lg,
    padding: 1,
    ...shadows.goldSm,
  },
  heroInner: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg - 1,
    overflow: 'hidden',
  },
});
