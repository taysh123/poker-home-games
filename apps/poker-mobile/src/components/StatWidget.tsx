import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { fadeIn, slideUp } from '../theme/motion';

type Props = {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  accentColor?: string;
  icon?: string;
  delay?: number;
};

export default function StatWidget({
  label,
  value,
  sub,
  valueColor = colors.text,
  accentColor = colors.gold,
  icon,
  delay = 0,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      fadeIn(opacity, { delay }),
      slideUp(translateY, { delay, from: 16 }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.card,
        { opacity, transform: [{ translateY }] },
        { borderTopColor: accentColor },
      ]}
    >
      {icon ? (
        <Text style={[styles.icon, { color: accentColor }]}>{icon}</Text>
      ) : (
        <View style={[styles.accentDot, { backgroundColor: accentColor }]} />
      )}
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 2,
    padding: 16,
    gap: 4,
    ...shadows.md,
  },
  icon: {
    fontSize: 18,
    marginBottom: 4,
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 6,
  },
  value: {
    ...typography.amountLarge,
  },
  label: {
    ...typography.caps,
    color: colors.textMuted,
    marginTop: 2,
  },
  sub: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 1,
  },
});
