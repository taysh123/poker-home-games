import React from 'react';
import { Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import PressableScale from './motion/PressableScale';

type Variant = 'gold' | 'outline' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  fullWidth?: boolean;
  style?: ViewStyle;
};

export default function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'gold',
  fullWidth = true,
  style,
}: Props) {
  const indicatorColor =
    variant === 'gold' ? colors.background : variant === 'outline' ? colors.gold : colors.error;

  return (
    <PressableScale
      style={[
        styles.base,
        variant === 'gold' ? styles.gold : variant === 'outline' ? styles.outline : styles.danger,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.dimmed,
        style,
      ]}
      onPress={onPress}
      haptic="light"
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'gold' ? styles.labelGold : variant === 'outline' ? styles.labelOutline : styles.labelDanger,
          ]}
        >
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  fullWidth: { alignSelf: 'stretch' },
  dimmed: { opacity: 0.6 },

  gold: { backgroundColor: colors.gold },
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
