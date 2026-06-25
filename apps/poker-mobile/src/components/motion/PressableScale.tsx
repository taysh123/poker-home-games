import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { lightTap, mediumTap } from '../../utils/haptics';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed (default 0.97). */
  activeScale?: number;
  /** Haptic feedback on press-in (native only; no-op on web). */
  haptic?: 'light' | 'medium' | 'none';
  children?: React.ReactNode;
};

/**
 * Base touchable for the motion system: springy press scale + optional haptic.
 * Drop-in replacement for TouchableOpacity in new/upgraded components.
 *
 * When the OS "reduce motion" setting is enabled, the scale animation is
 * suppressed (scale stays at 1) while haptic feedback and onPress are preserved.
 */
export default function PressableScale({
  style,
  activeScale = 0.97,
  haptic = 'none',
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={e => {
        if (!reducedMotion) {
          scale.value = withSpring(activeScale, { damping: 20, stiffness: 400 });
        }
        if (haptic === 'light') lightTap();
        else if (haptic === 'medium') mediumTap();
        onPressIn?.(e);
      }}
      onPressOut={e => {
        if (!reducedMotion) {
          scale.value = withSpring(1, { damping: 16, stiffness: 320 });
        }
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
