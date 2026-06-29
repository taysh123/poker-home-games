/**
 * Chip — the single small-label primitive (design system). Replaces the 5+ hand-rolled badge/chip/tier-label
 * styles scattered across content + prod surfaces. Token-driven; geometry pinned so adoption is byte-near to
 * the chips it replaces.
 *
 * - `tone` picks a token color triple (bg / border / fg).
 * - `solid` = filled accent fill AND flips icon+text to the on-accent color (so gold-on-gold never disappears).
 * - `dot` = leading status dot (live-style). `icon` = leading Ionicon.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii } from '../theme/radii';
import { chipVisual, type ChipTone, type ChipSize } from './chipVisual';

export type { ChipTone, ChipSize } from './chipVisual';

interface ChipProps {
  label: string;
  tone?: ChipTone;
  size?: ChipSize;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Filled accent fill (on-accent icon/text). Default subtle (faint bg + border). */
  solid?: boolean;
  /** Leading status dot. */
  dot?: boolean;
  style?: ViewStyle;
}

export default function Chip({ label, tone = 'neutral', size = 'sm', icon, solid = false, dot = false, style }: ChipProps) {
  const v = chipVisual(tone, solid, size);
  return (
    <View
      style={[
        styles.base,
        { paddingHorizontal: v.padH, paddingVertical: v.padV, borderRadius: radii.sm, backgroundColor: v.bg, borderColor: v.border },
        style,
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: v.fg }]} />}
      {icon && <Ionicons name={icon} size={v.font + 1} color={v.fg} style={styles.icon} />}
      <Text style={[styles.label, { color: v.fg, fontSize: v.font }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, alignSelf: 'flex-start', overflow: 'hidden' },
  label: { fontWeight: '700', letterSpacing: 0.4 },
  icon: { marginRight: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
});
