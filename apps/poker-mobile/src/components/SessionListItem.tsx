import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatPL } from '../utils/formatters';

type Props = {
  name: string;
  meta: string;
  profitLoss?: number | null;
  status?: string;
  onPress: () => void;
  isFirst?: boolean;
};

export default function SessionListItem({ name, meta, profitLoss, status, onPress, isFirst }: Props) {
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
    <TouchableOpacity
      style={[styles.row, !isFirst && styles.border]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.accent, { backgroundColor: isActive ? colors.gold : colors.border }]} />
      <View style={styles.content}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {isActive && (
            <View style={styles.livePill}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
      </View>
      {pl != null && (
        <Text style={[styles.pl, { color: plColor }]}>
          {formatPL(pl)}
        </Text>
      )}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
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
  livePill: {
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1,
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
  chevron: {
    fontSize: 18,
    color: colors.textDim,
    marginLeft: 2,
  },
});
