import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { useNetwork } from '../hooks/useNetwork';
import { isFeatureEnabled } from '../config/features';

/**
 * App-wide offline awareness (V2.1 STEP 4.1). Thin banner pinned under the status bar when the device
 * is offline — covers Study/Bankroll/Coach + future premium. Gated behind `polish` (prod unchanged off).
 */
export default function OfflineBanner() {
  const { offline } = useNetwork();
  const insets = useSafeAreaInsets();
  if (!isFeatureEnabled('polish') || !offline) return null;
  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + 6 }]}
      accessibilityRole="alert"
      accessibilityLabel="You are offline. Some features may be limited."
    >
      <Ionicons name="cloud-offline-outline" size={14} color={colors.background} />
      <Text style={styles.text}>You're offline — some features may be limited</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingBottom: 6, paddingHorizontal: spacing.lg, backgroundColor: colors.warning,
  },
  text: { ...typography.bodySmall, color: colors.background, fontWeight: '600' },
});
