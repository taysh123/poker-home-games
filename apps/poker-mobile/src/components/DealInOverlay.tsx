import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Pressable, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { Sora } from '../theme/fonts';
import { USE_NATIVE_DRIVER } from '../theme/motion';
import { mediumTap } from '../utils/haptics';

/**
 * Wow moment: a brief branded "Deal 'Em In" beat shown after a game is created,
 * before the live table appears. The T mark springs in, a gold sweep crosses, then
 * onDone navigates. Tap to skip. ~950ms — a one-time flourish, not in the hot loop.
 */
export default function DealInOverlay({ onDone }: { onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone(); };

  useEffect(() => {
    mediumTap();
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
    const sweepLoop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
    );
    sweepLoop.start();
    const t = setTimeout(finish, 950);
    return () => { clearTimeout(t); sweepLoop.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-130, 130] });

  return (
    <Pressable style={styles.overlay} onPress={finish} accessibilityLabel="Setting the table">
      <Animated.View style={[styles.center, { opacity, transform: [{ scale }] }]}>
        <View style={styles.logoRing}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.title}>Setting the table…</Text>
        <Text style={styles.subtitle}>You deal the cards — we keep the books.</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.sweepWrap, { transform: [{ translateX }] }]}>
            <LinearGradient
              colors={['transparent', colors.gold, 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sweep}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundDeep,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  center: { alignItems: 'center', gap: 18 },
  logoRing: {
    width: 92,
    height: 92,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.goldMuted,
    backgroundColor: colors.goldFaint,
  },
  logo: { width: 92, height: 92, borderRadius: 26 },
  title: { fontFamily: Sora['700'], fontSize: 18, color: colors.text, letterSpacing: 0.5 },
  // States plainly what the app does — the app keeps the ledger; the players deal the cards.
  subtitle: { fontFamily: Sora['500'], fontSize: 12, color: colors.textMuted, marginTop: 4 },
  track: { width: 140, height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  sweepWrap: { width: 80, height: 3 },
  sweep: { flex: 1, height: 3 },
});
