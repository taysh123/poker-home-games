import React from 'react';
import { Text, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { positionColor, type PokerPosition } from '../../utils/pokerTable';
import { typography } from '../../theme/typography';
import { radii } from '../../theme/radii';

/**
 * Position pill (V2.1) — colored by the shared position color system so each position reads natively on the
 * felt. Reused by `TableSeat` and `ActionTimeline` (single source of truth for position color).
 */
export default function PositionBadge({
  position,
  size = 'md',
  style,
}: {
  position: PokerPosition;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const c = positionColor(position);
  return (
    <View
      style={[styles.pill, size === 'sm' && styles.pillSm, { backgroundColor: c.bg, borderColor: c.text + '55' }, style]}
      accessibilityLabel={`${position} position`}
    >
      <Text style={[styles.text, size === 'sm' && styles.textSm, { color: c.text }]}>{position}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'center' },
  pillSm: { paddingHorizontal: 6, paddingVertical: 1 },
  text: { ...typography.caps, fontSize: 10, letterSpacing: 0.5 },
  textSm: { fontSize: 9 },
});
