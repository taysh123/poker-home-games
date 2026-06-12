import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { successNotification } from '../../utils/haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const PALETTE = ['#C9A84C', '#E8C97A', '#9C7E33', '#2ECC71', '#E8EDF2'];
const PARTICLES = Platform.OS === 'web' ? 24 : 44;
const DURATION = 2200;

type ParticleSpec = {
  startX: number;
  driftX: number;
  fall: number;
  delay: number;
  size: number;
  color: string;
  spin: number;
};

function Particle({ spec }: { spec: ParticleSpec }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      spec.delay,
      withTiming(1, { duration: DURATION - spec.delay, easing: Easing.out(Easing.quad) }),
    );
  }, [progress, spec.delay]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.75 ? 1 : 1 - (progress.value - 0.75) * 4,
    transform: [
      { translateX: spec.startX + progress.value * spec.driftX },
      { translateY: -40 + progress.value * spec.fall },
      { rotate: `${progress.value * spec.spin}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { width: spec.size, height: spec.size * 1.6, backgroundColor: spec.color },
        style,
      ]}
    />
  );
}

type Props = {
  /** Fire haptic success feedback when the burst starts (default true). */
  haptic?: boolean;
};

/**
 * Confetti burst for winner reveals and session completion. Renders once on
 * mount, auto-removes itself after the burst. Absolutely positioned overlay —
 * mount it last inside a flex:1 container.
 */
export default function Celebration({ haptic = true }: Props) {
  const [done, setDone] = useState(false);

  const particles = useMemo<ParticleSpec[]>(
    () =>
      Array.from({ length: PARTICLES }, () => ({
        startX: Math.random() * SCREEN_W,
        driftX: (Math.random() - 0.5) * 140,
        fall: SCREEN_H * (0.55 + Math.random() * 0.45),
        delay: Math.random() * 350,
        size: 6 + Math.random() * 6,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        spin: (Math.random() - 0.5) * 720,
      })),
    [],
  );

  useEffect(() => {
    if (haptic) successNotification();
    const timer = setTimeout(() => setDone(true), DURATION + 400);
    return () => clearTimeout(timer);
  }, [haptic]);

  if (done) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((spec, i) => (
        <Particle key={i} spec={spec} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 2,
  },
});
