import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { iconSize } from '../theme/iconSize';
import PressableScale from './motion/PressableScale';

type Props = {
  onPress: () => void;
  disabled?: boolean;
};

export default function GoogleAuthButton({ onPress, disabled }: Props) {
  return (
    <PressableScale
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPress}
      haptic="light"
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name="logo-google" size={iconSize.sm} color={colors.text} />
      <Text style={styles.text}>Continue with Google</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    // 12 matches AppTextInput + PrimaryButton (the auth-card form-control radius).
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 52,
    backgroundColor: colors.surface,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.label,
    color: colors.text,
  },
});
