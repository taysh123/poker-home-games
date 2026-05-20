import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  children: React.ReactNode;
  padded?: boolean;
  style?: ViewStyle;
};

export default function SectionCard({ children, padded = true, style }: Props) {
  return (
    <View style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  padded: { padding: 16 },
});
