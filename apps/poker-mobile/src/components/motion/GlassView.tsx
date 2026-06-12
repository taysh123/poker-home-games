import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../../theme/colors';

type Props = {
  style?: StyleProp<ViewStyle>;
  /** Blur strength on iOS (default 40). */
  intensity?: number;
  children?: React.ReactNode;
};

/**
 * Frosted-glass surface. Real blur on iOS only (cheap and native there);
 * Android and web get a solid surface — visually identical to today's UI.
 * Use ONLY on static chrome (tab bar, sheets) — never inside scrolling lists.
 */
export default function GlassView({ style, intensity = 40, children }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint="dark" style={[{ backgroundColor: 'rgba(26,37,53,0.62)' }, style]}>
        {children}
      </BlurView>
    );
  }
  return <View style={[{ backgroundColor: colors.surface }, style]}>{children}</View>;
}
