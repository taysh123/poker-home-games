import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { USE_NATIVE_DRIVER } from './../theme/motion';

type Props = {
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export default function SkeletonCard({ height = 80, borderRadius = 14, style }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={[styles.skeleton, { height, borderRadius, opacity }, style]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surfaceHigh,
    width: '100%',
  },
});
