import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatPL } from '../utils/formatters';
import Chip from './Chip';
import PressableScale from './motion/PressableScale';

type Props = {
  name: string;
  meta: string;
  profitLoss?: number | null;
  status?: string;
  onPress: () => void;
  isFirst?: boolean;
  showResultBadge?: boolean;
};

export default function SessionListItem({ name, meta, profitLoss, status, onPress, isFirst, showResultBadge }: Props) {
  const isActive = status === 'Active';
  const pl = profitLoss ?? null;
  // Derived ONCE and consumed by both the Chip and the accessible name, so the two cannot say
  // different things. They already did: a break-even row showed "EVEN" and announced only
  // formatPL(0) — "+₪0" — reporting a gain on a session the user broke even on.
  const result = showResultBadge && !isActive && pl != null
    ? (pl > 0 ? 'WIN' : pl < 0 ? 'LOSS' : 'EVEN')
    : null;
  const plColor = pl == null
    ? colors.textMuted
    : pl > 0
      ? colors.success
      : pl < 0
        ? colors.error
        : colors.textMuted;

  return (
    <PressableScale
      style={[styles.row, !isFirst && styles.border]}
      onPress={onPress}
      accessibilityRole="button"
      // Composed from everything the row shows, because accessibilityRole collapses the row to ONE
      // accessibility element. Without a label RN still derived a name from the child <Text> nodes,
      // so this is not "unlabelled → labelled" — it is an incidental announcement, in an order
      // nobody chose, replaced by a deliberate one. Every term below mirrors a rendered element;
      // a11yContract.test.tsx pins the composed string, because the role ratchet cannot see names.
      // This component renders in six screens, many rows each.
      accessibilityLabel={[
        name,
        isActive ? 'live' : null,
        result?.toLowerCase() ?? null,
        meta,
        pl != null ? formatPL(pl) : null,
      ].filter(Boolean).join(', ')}
    >
      <View style={[styles.accent, { backgroundColor: isActive ? colors.gold : colors.border }]} />
      <View style={styles.content}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {isActive && <Chip label="LIVE" tone="gold" dot />}
          {result && (
            <Chip label={result} tone={pl! > 0 ? 'success' : pl! < 0 ? 'error' : 'neutral'} />
          )}
        </View>
        <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
      </View>
      {pl != null && (
        <Text style={[styles.pl, { color: plColor }]}>
          {formatPL(pl)}
        </Text>
      )}
      <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    paddingVertical: 14,
    gap: 12,
  },
  border: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accent: {
    width: 3,
    height: 36,
    borderRadius: 2,
    marginLeft: 0,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 3,
    paddingLeft: 4,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    ...typography.label,
    color: colors.text,
    flex: 1,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  pl: {
    ...typography.labelSmall,
    fontVariant: ['tabular-nums'],
    minWidth: 52,
    textAlign: 'right',
  },
});
