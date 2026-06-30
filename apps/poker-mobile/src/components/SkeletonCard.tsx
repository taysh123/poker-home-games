import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Skeleton from './Skeleton';

type Props = {
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Loading placeholder with a sweeping shimmer (opacity pulse on web, static
 * under reduce motion). Thin wrapper over the generic `Skeleton` primitive —
 * kept for its established call sites (defaults: full-width, 80px tall).
 */
export default function SkeletonCard({ height = 80, borderRadius = 14, style }: Props) {
  return <Skeleton height={height} radius={borderRadius} style={style} />;
}
