import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
          {showResultBadge && !isActive && pl != null && (
            <View style={[
              styles.resultBadge,
              pl > 0 ? styles.resultBadgeWin : pl < 0 ? styles.resultBadgeLoss : styles.resultBadgeEven,
            ]}>
              <Text style={[
                styles.resultBadgeText,
                pl > 0 ? styles.resultTextWin : pl < 0 ? styles.resultTextLoss : styles.resultTextEven,
              ]}>
                {pl > 0 ? 'WIN' : pl < 0 ? 'LOSS' : 'EVEN'}
              </Text>
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
      <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
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
  resultBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  resultBadgeWin: { backgroundColor: 'rgba(39,174,96,0.12)', borderColor: 'rgba(39,174,96,0.4)' },
  resultBadgeLoss: { backgroundColor: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.35)' },
  resultBadgeEven: { backgroundColor: '#1E2D3D', borderColor: '#243447' },
  resultBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  resultTextWin: { color: '#27AE60' },
  resultTextLoss: { color: '#E74C3C' },
  resultTextEven: { color: '#7A8A99' },
});
