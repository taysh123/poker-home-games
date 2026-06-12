import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { avatarColor } from '../utils/avatarColor';

type Props = {
  /** Display name — drives the initial and the fallback color hash. */
  name: string;
  /** User-chosen emoji identity (renders instead of the initial when set). */
  emoji?: string | null;
  /** User-chosen accent color; falls back to the name hash. */
  color?: string | null;
  /** Diameter in px (default 40). */
  size?: number;
  /** Optional ring: brand gold, or a custom color (e.g. performance tint). */
  ring?: 'gold' | string;
  style?: StyleProp<ViewStyle>;
};

/**
 * THE avatar. Every initials/emoji circle in the app renders through this —
 * never hand-roll avatar circles in screens (see CLAUDE.md).
 */
export default function Avatar({ name, emoji, color, size = 40, ring, style }: Props) {
  const accent = color || avatarColor(name || '?');
  const ringColor = ring === 'gold' ? colors.goldSubtle : ring;
  const initial = (name?.[0] ?? '?').toUpperCase();

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: accent + '22',
          borderColor: ringColor ?? accent + '55',
          borderWidth: ring ? 2 : 1,
        },
        style,
      ]}
    >
      {emoji ? (
        <Text style={{ fontSize: size * 0.5 }} allowFontScaling={false}>{emoji}</Text>
      ) : (
        <Text
          style={[styles.initial, { fontSize: size * 0.4, color: accent }]}
          allowFontScaling={false}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontWeight: '700' },
});
