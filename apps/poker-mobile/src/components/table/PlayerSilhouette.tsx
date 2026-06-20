import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

/**
 * Anonymous seat presence (V2.1) — a person-icon token used when a seat has no real identity
 * (trainer opponents) or is unoccupied. Reusable across the table system so non-hero players still
 * read as a clear presence around the felt. Never shows hole cards.
 *  - `present` solid disc + person icon (a seated, in-hand/folded opponent — dimming is the seat's job)
 *  - `empty`   dashed outline (an open seat)
 */
export default function PlayerSilhouette({
  size = 40,
  variant = 'present',
}: {
  size?: number;
  variant?: 'present' | 'empty';
}) {
  const empty = variant === 'empty';
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderStyle: empty ? 'dashed' : 'solid',
          borderColor: empty ? colors.border : colors.textDim,
          backgroundColor: empty ? 'transparent' : colors.surfaceHigh,
        },
      ]}
    >
      <Ionicons name="person" size={size * 0.5} color={empty ? colors.textDim : colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
});
