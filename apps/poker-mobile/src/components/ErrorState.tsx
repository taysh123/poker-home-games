import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PrimaryButton from './PrimaryButton';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';

/**
 * Reusable error state with a retry (V2.1 STEP 4.1) — mirrors EmptyState. Use where a fetch can fail
 * instead of silently degrading.
 */
export default function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't load this. Check your connection and try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.wrap} accessibilityLabel={`${title}. ${message}`}>
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={30} color={colors.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <PrimaryButton label="Retry" variant="outline" onPress={onRetry} fullWidth={false} style={styles.btn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  iconWrap: {
    width: 68, height: 68, borderRadius: radii.lg, backgroundColor: colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  title: { ...typography.h3, color: colors.text, textAlign: 'center' },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  btn: { marginTop: spacing.md },
});
