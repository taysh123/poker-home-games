import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { registerToastListener } from '../utils/toast';
import { colors } from '../theme/colors';
import { USE_NATIVE_DRIVER } from '../theme/motion';

type Variant = 'success' | 'error' | 'info';

const ICONS: Record<Variant, string> = {
  success: '✓',
  error: '✕',
  info: 'i',
};

const BG: Record<Variant, string> = {
  success: colors.success,
  error: colors.error,
  info: colors.gold,
};

export default function Toast() {
  const [message, setMessage] = useState('');
  const [variant, setVariant] = useState<Variant>('info');
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return registerToastListener((text, v) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(text);
      setVariant(v);
      // Toasts are the app's primary feedback channel — announce to screen readers
      // (the container is pointerEvents="none", so VoiceOver/TalkBack won't reach it otherwise).
      AccessibilityInfo.announceForAccessibility?.(text);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();

      timer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
        ]).start();
      }, 2500);
    });
  }, []);

  return (
    <Animated.View
      style={[styles.container, { opacity, transform: [{ translateY }] }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <View
        style={[styles.pill, { backgroundColor: BG[variant] }]}
        accessible
        accessibilityRole="alert"
        accessibilityLabel={message}
      >
        <Text style={styles.icon} importantForAccessibility="no">{ICONS[variant]}</Text>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  icon: { fontSize: 13, fontWeight: '800', color: '#fff' },
  text: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
