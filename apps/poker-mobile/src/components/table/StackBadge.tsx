import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ChipStack from './ChipStack';
import { useMoney } from '../../context/CurrencyContext';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

/**
 * Seat stack readout (V2.1) — "42 BB" (study/training) or currency (cash/summary, via `cents`) with a subtle
 * chip-stack cue. `allin` swaps to a gold ALL-IN treatment. Reusable across the table system.
 */
export default function StackBadge({ bb, cents, allin }: { bb?: number; cents?: number; allin?: boolean }) {
  const { format } = useMoney();
  const label = allin ? 'ALL-IN' : cents != null ? format(cents) : bb != null ? `${formatBb(bb)} BB` : '';
  if (!label) return null;
  // A small cosmetic chip cue. In bb mode we synthesize a few chips from the bb count.
  const cueCents = cents != null ? cents : bb != null ? Math.round(bb) * 100 : 0;
  return (
    <View style={styles.row} accessibilityLabel={allin ? 'All in' : `Stack ${label}`}>
      {!allin && cueCents > 0 ? <ChipStack amountCents={cueCents} chipWidth={9} /> : null}
      <Text style={[styles.text, allin && styles.allin]}>{label}</Text>
    </View>
  );
}

function formatBb(bb: number): string {
  return Number.isInteger(bb) ? String(bb) : bb.toFixed(1);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  text: { ...typography.bodySmall, fontSize: 10, color: colors.textMuted },
  allin: { ...typography.caps, fontSize: 9, color: colors.goldLight },
});
