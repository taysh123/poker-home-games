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
    >
      <View style={[styles.accent, { backgroundColor: isActive ? colors.gold : colors.border }]} />
      <View style={styles.content}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {isActive && <Chip label="LIVE" tone="gold" dot />}
          {showResultBadge && !isActive && pl != null && (
            <Chip label={pl > 0 ? 'WIN' : pl < 0 ? 'LOSS' : 'EVEN'} tone={pl > 0 ? 'success' : pl < 0 ? 'error' : 'neutral'} />
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
