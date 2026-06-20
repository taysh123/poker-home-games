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
export default function Pot({ amountCents, label = 'POT' }: { amountCents: number; label?: string }) {
  const { format } = useMoney();
  return (
    <View style={styles.pot} accessibilityLabel={`${label} ${format(amountCents)}`}>
      <ChipStack amountCents={amountCents} chipWidth={26} />
      <Text style={styles.amount}>{format(amountCents)}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pot: { alignItems: 'center', gap: 2 },
  amount: { ...typography.amount, color: colors.goldLight, marginTop: spacing.xs },
  label: { ...typography.caps, fontSize: 9, color: 'rgba(232,201,122,0.7)' },
});
