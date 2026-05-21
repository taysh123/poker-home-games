import { Animated, Easing } from 'react-native';

export const durations = {
  instant:  80,
  fast:    150,
  normal:  250,
  slow:    400,
  slower:  600,
} as const;

export const easings = {
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  decelerate: Easing.bezier(0, 0, 0.2, 1),
  accelerate: Easing.bezier(0.4, 0, 1, 1),
  spring: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

export function fadeIn(
  value: Animated.Value,
  options?: { duration?: number; delay?: number },
) {
  return Animated.timing(value, {
    toValue: 1,
    duration: options?.duration ?? durations.normal,
    delay: options?.delay ?? 0,
    easing: easings.decelerate,
    useNativeDriver: true,
  });
}

export function slideUp(
  value: Animated.Value,
  options?: { duration?: number; delay?: number; from?: number },
) {
  value.setValue(options?.from ?? 24);
  return Animated.timing(value, {
    toValue: 0,
    duration: options?.duration ?? durations.slow,
    delay: options?.delay ?? 0,
    easing: easings.decelerate,
    useNativeDriver: true,
  });
}

export function springScale(
  value: Animated.Value,
  toValue: number,
) {
  return Animated.spring(value, {
    toValue,
    friction: 8,
    tension: 100,
    useNativeDriver: true,
  });
}

export function pulse(value: Animated.Value) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 0.25,
        duration: 900,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 1,
        duration: 900,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]),
  );
}

export function staggered(animations: Animated.CompositeAnimation[], stagger = 60) {
  return Animated.stagger(stagger, animations);
}
