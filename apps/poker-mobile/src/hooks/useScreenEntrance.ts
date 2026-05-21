import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fadeIn, slideUp } from '../theme/motion';

export function useScreenEntrance(duration = 350) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0);
      translateY.setValue(20);
      Animated.parallel([
        fadeIn(opacity, { duration }),
        slideUp(translateY, { duration, from: 20 }),
      ]).start();
    }, []),
  );

  return {
    opacity,
    translateY,
    style: { opacity, transform: [{ translateY }] } as const,
  };
}
