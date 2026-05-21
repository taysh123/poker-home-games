import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import SkeletonCard from './SkeletonCard';

type Props = {
  isFirst?: boolean;
};

export default function SkeletonRow({ isFirst = false }: Props) {
  return (
    <View style={[styles.row, !isFirst && styles.border]}>
      <View style={styles.accent} />
      <View style={styles.content}>
        <SkeletonCard height={14} borderRadius={4} style={{ width: '60%' }} />
        <SkeletonCard height={10} borderRadius={4} style={{ width: '40%', marginTop: 8 }} />
      </View>
      <SkeletonCard height={14} borderRadius={4} style={{ width: 52 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
  },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  accent: {
    width: 3,
    height: 36,
    borderRadius: 2,
    backgroundColor: colors.border,
    flexShrink: 0,
  },
  content: { flex: 1 },
});
