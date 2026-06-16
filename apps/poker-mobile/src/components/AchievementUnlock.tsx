import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Sora } from '../theme/fonts';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { USE_NATIVE_DRIVER } from '../theme/motion';
import { successNotification } from '../utils/haptics';
import Celebration from './motion/Celebration';
import PrimaryButton from './PrimaryButton';
import type { AchievementDto } from '../api/achievementsApi';

const RARITY_COLORS: Record<string, string> = {
  Common: colors.textMuted,
  Rare: '#4EAADC',
  Epic: '#C46EE8',
  Legendary: colors.gold,
};

type Props = {
  /** Newly-unlocked achievements to celebrate, shown one at a time. */
  achievements: AchievementDto[];
  onDone: () => void;
};

/**
 * Wow moment: a cinematic, rarity-tinted celebration when achievements unlock.
 * Spring-in badge with a rarity glow, confetti, success haptic; queues multiple.
 */
export default function AchievementUnlock({ achievements, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const current = achievements[idx];
  const rarity = current ? RARITY_COLORS[current.rarity] ?? colors.gold : colors.gold;

  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!current) return;
    scale.setValue(0.6);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
    successNotification();
  }, [idx, current]);

  if (!current) return null;

  const advance = () => {
    if (idx + 1 < achievements.length) setIdx(idx + 1);
    else onDone();
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={advance} />
      <Celebration />
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <LinearGradient
          colors={[rarity + '33', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.glow}
          pointerEvents="none"
        />
        <Text style={styles.kicker}>ACHIEVEMENT UNLOCKED</Text>
        <View style={[styles.iconRing, { borderColor: rarity + '88', backgroundColor: rarity + '1A' }]}>
          <Ionicons name={current.iconKey as any} size={40} color={rarity} />
        </View>
        <Text style={styles.name}>{current.name}</Text>
        <View style={[styles.rarityPill, { borderColor: rarity + '66', backgroundColor: rarity + '14' }]}>
          <Text style={[styles.rarityText, { color: rarity }]}>{current.rarity}</Text>
        </View>
        <Text style={styles.description}>{current.description}</Text>
        <PrimaryButton
          label={idx + 1 < achievements.length ? `Next (${idx + 1}/${achievements.length})` : 'Nice!'}
          onPress={advance}
          style={styles.button}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: spacing.xl },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surfaceOverlay },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: 12,
    overflow: 'hidden',
  },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },
  kicker: { ...typography.caps, color: colors.gold, letterSpacing: 2 },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  name: { fontFamily: Sora['700'], fontSize: 22, color: colors.text, textAlign: 'center' },
  rarityPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  rarityText: { fontFamily: Sora['600'], fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  description: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  button: { marginTop: 8, alignSelf: 'stretch' },
});
