import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';

/** Centers content with a max width on wide screens; full-width on phones (maxWidth never < screen).
 *  Use to wrap scroll content / table areas so desktop web does not stretch a mobile-first layout. */
export default function ContentContainer({ children, maxWidth = 1100, style }:
  { children: React.ReactNode; maxWidth?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.base, { maxWidth }, style]}>{children}</View>;
}
const styles = StyleSheet.create({ base: { width: '100%', alignSelf: 'center' } });