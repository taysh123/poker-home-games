import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fadeIn, slideUp } from '../theme/motion';
import { useReducedMotion } from './useReducedMotion';

export function useScreenEntrance(duration = 350) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const reduced = useReducedMotion();

  useFocusEffect(
    useCallback(() => {
      // Respect OS Reduce Motion: render the final state instantly, no fade/slide.
      if (reduced) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }
      opacity.setValue(0);
      translateY.setValue(20);
      Animated.parallel([
        fadeIn(opacity, { duration }),
        slideUp(translateY, { duration, from: 20 }),
      ]).start();
    }, [reduced]),
  );

  return {
    opacity,
    translateY,
    style: { opacity, transform: [{ translateY }] } as const,
  };
}
