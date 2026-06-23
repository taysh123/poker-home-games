import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import { spacing } from '../theme/spacing';

interface Props {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  /** Secondary-panel width on desktop/tablet (px). */
  secondaryWidth?: number;
}

/** Two-panel layout: side-by-side on desktop/tablet, stacked (primary first) on mobile. */
export default function SplitPane({ primary, secondary, secondaryWidth = 340 }: Props) {
  const { isMobile } = useResponsive();
  if (isMobile) {
    return (
      <View style={styles.stack}>
        <View style={styles.flex}>{primary}</View>
        {secondary}
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <View style={styles.flex}>{primary}</View>
      <View style={{ width: secondaryWidth }}>{secondary}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1, gap: spacing.lg },
  row: { flex: 1, flexDirection: 'row', gap: spacing.lg },
  flex: { flex: 1 },
});
