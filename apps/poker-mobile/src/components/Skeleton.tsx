import React, { useState } from 'react';
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import Shimmer from './motion/Shimmer';

type Props = {
  /** Block width — number (px) or a percentage string. Default '100%'. */
  width?: DimensionValue;
  /** Block height in px. Default 16. */
  height?: number;
  /** Corner radius. Default radii.sm. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Generic shimmer placeholder block — the design-system primitive that
 * `SkeletonCard` / `SkeletonRow` compose. Hidden from assistive tech (it's a
 * transient loading affordance); the Shimmer inside is static under reduce
 * motion. Measures its own width so the sweep distance is correct.
 */
export default function Skeleton({ width = '100%', height = 16, radius = radii.sm, style }: Props) {
  const [measured, setMeasured] = useState(0);

  return (
    <View
      style={[styles.base, { width, height, borderRadius: radius }, style]}
      onLayout={e => setMeasured(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {measured > 0 && <Shimmer width={measured} />}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
});
