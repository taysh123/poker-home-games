import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { formatCentsSigned } from '../../../utils/money';
import { monthLabel, shiftMonth } from '../logic/monthGrid';
import type { MonthBucket } from '../logic/calendar';

/**
 * Month selector + that month's net (B5). Arrows move one month at a time; the header states
 * the month and its P&L so the calendar below always has a stated total to be read against —
 * the heat ramp is relative to the month, so the absolute number has to be said somewhere.
 *
 * Gold is deliberately absent here: it is reserved for primary CTAs and key financial numbers,
 * and a month that happens to be up already gets `success`.
 */
export default function BankrollMonthStrip({
  monthKey,
  months,
  onChangeMonth,
}: {
  monthKey: string;
  months: MonthBucket[];
  onChangeMonth: (monthKey: string) => void;
}) {
  const bucket = months.find(m => m.monthKey === monthKey);
  const net = bucket?.netCents ?? 0;
  const sessions = bucket?.sessionCount ?? 0;
  const netColor = net > 0 ? colors.success : net < 0 ? colors.error : colors.textHigh;

  const prev = shiftMonth(monthKey, -1);
  const next = shiftMonth(monthKey, 1);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChangeMonth(prev)}
        accessibilityRole="button"
        accessibilityLabel={`Previous month, ${monthLabel(prev)}`}
        hitSlop={8}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
      </Pressable>

      <View style={styles.center}>
        <Text style={styles.month}>{monthLabel(monthKey)}</Text>
        <Text style={[styles.net, { color: netColor }]}>
          {sessions === 0
            ? 'No sessions'
            : `${formatCentsSigned(net)} · ${sessions} session${sessions === 1 ? '' : 's'}`}
        </Text>
      </View>

      <Pressable
        onPress={() => onChangeMonth(next)}
        accessibilityRole="button"
        accessibilityLabel={`Next month, ${monthLabel(next)}`}
        hitSlop={8}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  pressed: { opacity: 0.6 },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  month: { ...typography.h3, color: colors.text },
  net: { ...typography.bodySmall, marginTop: 2 },
});
