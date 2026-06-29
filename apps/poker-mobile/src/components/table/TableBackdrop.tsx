import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Lightweight felt screen-background layer (V2.1 STEP 5.3) — a subtle table-felt tint fading out, for
 * entry screens that should feel "at the table" without a full table scene. Non-interactive overlay.
 */
export default function TableBackdrop({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={['rgba(26,75,67,0.30)', 'rgba(21,65,58,0.10)', 'transparent']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.backdrop, style]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
});
