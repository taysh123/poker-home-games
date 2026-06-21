/**
 * ListRow — the icon + title + meta + chips row used across content lists (lessons, packs, coach methods).
 * Replaces per-screen hand-rolled `<PressableScale><Card style={row}>…` blocks with one layout.
 *
 * Layout (matches the real pack-row shape):
 *   row 1: [icon] title (left, `titleLines`)            titleRight (inline trailing; chevron by default)
 *   row 2: subtitle / meta
 *   row 3: chips
 * `dim` = coming-soon style; `onPress` makes it pressable (spring + haptic) and shows a default chevron.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import PressableScale from './motion/PressableScale';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';

interface ListRowProps {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  title: string;
  titleLines?: number;
  /** Inline trailing element on the title row. Defaults to a chevron when onPress is set. */
  titleRight?: React.ReactNode;
  subtitle?: string;
  /** Chips row (e.g. <Chip>). */
  chips?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  dim?: boolean;
  accessibilityLabel?: string;
}

export default function ListRow({
  icon, iconColor = colors.gold, title, titleLines = 1, titleRight, subtitle, chips,
  onPress, disabled, dim, accessibilityLabel,
}: ListRowProps) {
  const right = titleRight ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null);

  const body = (
    <Card style={StyleSheet.flatten([styles.card, dim && styles.dim])}>
      <View style={styles.topRow}>
        {icon && (
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={20} color={iconColor} />
          </View>
        )}
        <Text style={styles.title} numberOfLines={titleLines}>{title}</Text>
        {right}
      </View>
      {!!subtitle && <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>}
      {!!chips && <View style={styles.chips}>{chips}</View>}
    </Card>
  );

  if (!onPress) return body;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  dim: { opacity: 0.55 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.goldFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { ...typography.h4, color: colors.text, flex: 1 },
  subtitle: { ...typography.bodySmall, color: colors.textMuted },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
});
