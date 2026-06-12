import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

type Props = {
  /** Rendered verbatim — pass pre-uppercased strings (no textTransform here,
   *  so existing literals like 'RECENT GAMES' keep matching tests). */
  children: string;
  /** Optional right-aligned action (e.g. "+ Add Player", "See all"). */
  action?: React.ReactNode;
};

/** The uppercase letter-spaced section label, previously duplicated per screen. */
export default function SectionTitle({ children, action }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{children}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  label: { ...typography.caps, textTransform: 'none', color: colors.textMuted },
});
