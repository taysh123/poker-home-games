import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';

type Props = {
  title: string;
  subtitle?: string;
  /** Renders a back button when provided. */
  onBack?: () => void;
  /** Right-side slot (icon buttons, badges). */
  right?: React.ReactNode;
  /** Large serif title for top-level tab screens; compact for deep screens. */
  large?: boolean;
};

/**
 * Unified screen header — replaces the three ad-hoc header patterns.
 * Owns its safe-area top inset; screens using it should not add their own.
 */
export default function ScreenHeader({ title, subtitle, onBack, right, large = false }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.row}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={8} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={styles.titles}>
          <Text
            style={[large ? styles.titleLarge : styles.title, onBack && !right ? styles.titleCentered : null]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, onBack && !right ? styles.titleCentered : null]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : onBack ? <View style={{ width: 40 }} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: 2 },
  title: { ...typography.h3, color: colors.text },
  titleLarge: { ...typography.displaySerif, color: colors.text },
  titleCentered: { textAlign: 'center' },
  subtitle: { ...typography.bodySmall, color: colors.textMuted },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
