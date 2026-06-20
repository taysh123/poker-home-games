import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import PositionBadge from './PositionBadge';
import { ACTION_META } from '../../utils/pokerTable';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';
import type { TimelineStep } from '../../utils/trainerHand';

/**
 * Action Timeline (V2.1) — a premium horizontal track of the preflop action up to hero: who posted, who
 * folded, who raised and for how much, ending in a highlighted "You're up" hero chip. Makes the hand legible
 * before the user acts. The hero chip pulses subtly (reduced-motion safe). Reusable for replay / review.
 */
export default function ActionTimeline({ steps }: { steps: TimelineStep[] }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = reduced ? 0 : withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduced, pulse]);
  const heroPulse = useAnimatedStyle(() => ({ opacity: 0.6 + pulse.value * 0.4 }));

  const a11y = steps
    .map(s => (s.isHero ? "you're up" : `${s.position} ${s.action}${s.amountBb ? ` ${fmt(s.amountBb)}bb` : ''}`))
    .join(', ');

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}
      accessible
      accessibilityLabel={`Action: ${a11y}`}
    >
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <Ionicons name="chevron-forward" size={12} color={colors.textDim} style={styles.arrow} /> : null}
          {s.isHero ? (
            <Animated.View style={[styles.chip, styles.heroChip, heroPulse]}>
              <Ionicons name="person" size={11} color={colors.backgroundDeep} />
              <Text style={styles.heroText}>You're up</Text>
            </Animated.View>
          ) : (
            <Step step={s} />
          )}
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

function Step({ step }: { step: TimelineStep }) {
  const isPost = step.action === 'post';
  const meta = step.action && step.action !== 'post' ? ACTION_META[step.action] : null;
  const tint = isPost ? colors.textMuted : meta?.tint ?? colors.textMuted;
  const icon = isPost ? 'ellipse-outline' : (meta?.icon ?? 'ellipse-outline');
  const label = isPost ? 'posts' : meta?.label ?? '';
  return (
    <View style={styles.chip}>
      <PositionBadge position={step.position} size="sm" />
      <Ionicons name={icon as React.ComponentProps<typeof Ionicons>['name']} size={12} color={tint} />
      <Text style={[styles.actText, { color: tint }]}>
        {label}{step.amountBb ? ` ${fmt(step.amountBb)}bb` : ''}
      </Text>
    </View>
  );
}

function fmt(bb: number): string {
  return Number.isInteger(bb) ? String(bb) : bb.toFixed(1);
}

const styles = StyleSheet.create({
  track: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  arrow: { marginHorizontal: 1 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 4,
  },
  actText: { ...typography.caps, fontSize: 10 },
  heroChip: { backgroundColor: colors.goldLight, borderColor: colors.gold },
  heroText: { ...typography.caps, fontSize: 10, color: colors.backgroundDeep },
});
