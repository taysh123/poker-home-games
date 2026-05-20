import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  label: string;
  children: React.ReactNode;
  hint?: string;
};

export default function FormRow({ label, children, hint }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  hint: { fontSize: 12, color: colors.textMuted },
});
