import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Platform } from 'react-native';
import { colors, gradients } from '../theme/colors';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Opt-in entrance animation (native only — layout-anim guard for web). */
  animated?: boolean;
};

/**
 * Velvet Table screen base: deep background + ambient gradient vignette.
 * Does NOT pad for safe areas — headers/content own their own insets
 * (matches existing screen patterns).
 */
export default function Screen({ children, style, animated = false }: Props) {
  // `style` is applied to the CONTENT container (inside the gradient), so
  // padding/centering styles behave as screens expect.
  const content = animated && Platform.OS !== 'web' ? (
    <Animated.View style={[styles.flex, style]} entering={FadeInDown.duration(300)}>
      {children}
    </Animated.View>
  ) : (
    <View style={[styles.flex, style]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...gradients.screenVignette]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundDeep },
  flex: { flex: 1 },
});
