import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, tableGradients } from '../../theme/colors';

/**
 * Immersive poker-table surface (V2.1 STEP 5.3) — a felt oval with a gold rim + inner vignette.
 * `children` render in the center (pot/cards); `seats` is an absolutely-positioned overlay sized to
 * the same width×height box. Static (no motion) for performance + reduced-motion safety.
 */
export default function PokerTable({
  width,
  height,
  children,
  seats,
  style,
}: {
  width: number;
  height: number;
  children?: React.ReactNode;
  seats?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const radius = height / 2;
  return (
    <View style={[{ width, height }, style]}>
      <LinearGradient
        colors={tableGradients.felt}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.felt, { width, height, borderRadius: radius }]}
      >
        <View style={[styles.rim, { borderRadius: radius }]} pointerEvents="none" />
        <View style={styles.center} pointerEvents="box-none">{children}</View>
      </LinearGradient>
      {seats}
    </View>
  );
}

const styles = StyleSheet.create({
  felt: {
    borderWidth: 2,
    borderColor: colors.goldMuted,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  // Inner hairline rim for depth (gold inset glow).
  rim: {
    ...StyleSheet.absoluteFillObject,
    margin: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
  },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
