import React, { useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import Shimmer from './motion/Shimmer';

type Props = {
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

/** Loading placeholder with a sweeping shimmer (opacity pulse on web). */
export default function SkeletonCard({ height = 80, borderRadius = 14, style }: Props) {
  const [width, setWidth] = useState(0);

  return (
    <View
      style={[styles.skeleton, { height, borderRadius }, style]}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && <Shimmer width={width} />}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surfaceHigh,
    width: '100%',
    overflow: 'hidden',
  },
});
