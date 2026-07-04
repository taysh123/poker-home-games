import React from 'react';
import { Text, ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../theme/colors';
import { radii } from '../theme/radii';
import PressableScale from './motion/PressableScale';

type Variant = 'gold' | 'gradient' | 'outline' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  fullWidth?: boolean;
  style?: ViewStyle;
  /** Explicit accessible name — defaults to `label` text when omitted. */
  accessibilityLabel?: string;
};

export default function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'gold',
  fullWidth = true,
  style,
  accessibilityLabel,
}: Props) {
  const indicatorColor =
    variant === 'gold' || variant === 'gradient'
      ? colors.background
      : variant === 'outline'
        ? colors.gold
        : colors.error;

  const content = loading ? (
    <ActivityIndicator color={indicatorColor} size="small" />
  ) : (
    <Text
      style={[
        styles.label,
        variant === 'gold' || variant === 'gradient'
          ? styles.labelGold
          : variant === 'outline'
            ? styles.labelOutline
            : styles.labelDanger,
      ]}
    >
      {label}
    </Text>
  );

  return (
    <PressableScale
      style={[
        styles.base,
        variant === 'gold'
          ? styles.gold
          : variant === 'gradient'
            ? styles.gradientShell
            : variant === 'outline'
              ? styles.outline
              : styles.danger,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.dimmed,
        style,
      ]}
      onPress={onPress}
      haptic="light"
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {variant === 'gradient' && (
        <LinearGradient
          colors={[...gradients.goldShine]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.content}>{content}</View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  fullWidth: { alignSelf: 'stretch' },
  dimmed: { opacity: 0.6 },

  gold: { backgroundColor: colors.gold },
  gradientShell: { overflow: 'hidden', backgroundColor: colors.gold },
  content: { alignItems: 'center', justifyContent: 'center' },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  danger: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.error,
  },

  label: { fontSize: 16, fontWeight: '700' },
  labelGold: { color: colors.background },
  labelOutline: { color: colors.gold },
  labelDanger: { color: colors.error },
});
