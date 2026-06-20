import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ChipStack from './ChipStack';
import { useMoney } from '../../context/CurrencyContext';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radii } from '../../theme/radii';

/**
 * A player's committed chips "in front" of their seat (V2.1) — a chip stack + amount. Placed by `TableScene`
 * partway between a seat and the pot so the table reads like a real hand. Structured so chips-to-pot motion
 * can be layered later. Reusable across trainer / replay / review.
 */
export default function BetChip({ amountBb, amountCents }: { amountBb?: number; amountCents?: number }) {
  const { format } = useMoney();
  const label = amountCents != null ? format(amountCents) : amountBb != null ? `${formatBb(amountBb)}bb` : '';
  if (!label) return null;
  const cueCents = amountCents != null ? amountCents : amountBb != null ? Math.max(1, Math.round(amountBb)) * 100 : 0;
  return (
    <View style={styles.wrap} accessibilityLabel={`Committed ${label}`}>
      <ChipStack amountCents={cueCents} chipWidth={14} />
      <View style={styles.pill}><Text style={styles.text}>{label}</Text></View>
    </View>
  );
}

function formatBb(bb: number): string {
  return Number.isInteger(bb) ? String(bb) : bb.toFixed(1);
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  pill: {
    backgroundColor: colors.surfaceOverlay, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.goldMuted,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  text: { ...typography.caps, fontSize: 9, color: colors.goldLight },
});
