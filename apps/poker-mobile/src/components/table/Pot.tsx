import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ChipStack from './ChipStack';
import { useMoney } from '../../context/CurrencyContext';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

/**
 * Center-of-table pot (V2.1 STEP 5.3) — currency-aware amount + chip-stack visual. Reusable;
 * lightweight; structured so chips-into-pot motion can be added later (reduced-motion safe).
 */
export default function Pot({
  amountCents,
  bb,
  label = 'POT',
}: {
  amountCents?: number;
  /** Study/training context — show the pot in big blinds instead of currency. */
  bb?: number;
  label?: string;
}) {
  const { format } = useMoney();
  const text = bb != null ? `${Number.isInteger(bb) ? bb : bb.toFixed(1)} BB` : format(amountCents ?? 0);
  const cueCents = amountCents != null ? amountCents : bb != null ? Math.max(1, Math.round(bb)) * 100 : 0;
  return (
    <View style={styles.pot} accessibilityLabel={`${label} ${text}`}>
      <ChipStack amountCents={cueCents} chipWidth={26} />
      <Text style={styles.amount}>{text}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pot: { alignItems: 'center', gap: 2 },
  amount: { ...typography.amount, color: colors.goldLight, marginTop: spacing.xs },
  label: { ...typography.caps, fontSize: 9, color: 'rgba(232,201,122,0.7)' },
});
