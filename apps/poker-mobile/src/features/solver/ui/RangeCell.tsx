import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ActionFrequency } from '../../study/types';
import { colors } from '../../../theme/colors';

function actionColor(action: string): string {
  if (action === 'raise') return colors.gold;
  if (action === 'call') return colors.success;
  return colors.surfaceAlt; // fold / remainder
}

interface Props {
  hand: string;
  mix: ActionFrequency[];
  selected?: boolean;
  size?: number;
  onPress?: () => void;
}

/**
 * A single 13×13 cell: hand label over a frequency bar (raise=gold, call=green, fold=remainder). Memoized so
 * the grid doesn't re-render every cell on hover/selection of another cell (performance budget — Phase D).
 */
function RangeCellBase({ hand, mix, selected, size = 30, onPress }: Props) {
  const nonFold = mix.filter(a => a.action !== 'fold' && a.freq > 0);
  const taken = nonFold.reduce((s, a) => s + a.freq, 0);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${hand}: ${mix.map(a => `${a.action} ${Math.round(a.freq * 100)}%`).join(', ') || 'no data'}`}
      style={[styles.cell, { width: size, height: size }, selected && styles.selected]}
    >
      <View style={styles.bars} pointerEvents="none">
        {nonFold.map((a, i) => (
          <View key={i} style={{ flex: a.freq, backgroundColor: actionColor(a.action) }} />
        ))}
        <View style={{ flex: Math.max(0, 1 - taken), backgroundColor: colors.surfaceAlt }} />
      </View>
      <Text style={styles.label} numberOfLines={1}>{hand}</Text>
    </Pressable>
  );
}

export const RangeCell = React.memo(RangeCellBase);

const styles = StyleSheet.create({
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selected: { borderColor: colors.gold, borderWidth: 2 },
  bars: { ...StyleSheet.absoluteFillObject, flexDirection: 'column-reverse' },
  label: { fontSize: 9, color: colors.text, fontWeight: '600' },
});
