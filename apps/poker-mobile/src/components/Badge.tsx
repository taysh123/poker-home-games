import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Variant = 'active' | 'draft' | 'finished' | 'gold' | 'muted';

type Props = {
  label: string;
  variant?: Variant;
};

export default function Badge({ label, variant = 'muted' }: Props) {
  return (
    <View style={[styles.base, styles[variant]]}>
      {variant === 'active' && <View style={styles.dot} />}
      <Text style={[styles.text, variant === 'active' ? styles.textActive : styles.textMuted]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
  },
  active: { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: colors.gold },
  draft: { backgroundColor: colors.surfaceHigh, borderColor: colors.border },
  finished: { backgroundColor: colors.surfaceHigh, borderColor: colors.border },
  gold: { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: colors.gold },
  muted: { backgroundColor: colors.surfaceHigh, borderColor: colors.border },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  textActive: { color: colors.gold },
  textMuted: { color: colors.textMuted },
});
