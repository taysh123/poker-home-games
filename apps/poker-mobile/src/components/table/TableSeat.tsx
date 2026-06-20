import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Avatar from '../Avatar';
import DealerButton from './DealerButton';
import ActionBadge from './ActionBadge';
import PlayerSilhouette from './PlayerSilhouette';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radii } from '../../theme/radii';
import type { PokerPosition, PlayerAction, SeatState } from '../../utils/pokerTable';

export interface SeatProps {
  name: string;
  emoji?: string;
  color?: string;
  /** Secondary line (chips / result / stack). */
  sub?: string;
  position?: PokerPosition;
  action?: PlayerAction;
  /** Presence around the table. When omitted, falls back to a neutral full avatar (legacy / summary). */
  state?: SeatState;
  /** Render an anonymous person silhouette instead of an initials/emoji avatar (trainer opponents). */
  anonymous?: boolean;
  /** Legacy flag — gold ring. `state` supersedes this when provided. */
  active?: boolean;
  isDealer?: boolean;
}

const SEAT_W = 76;
const AVATAR = 40;
const RING = 48;

const STATE_WORD: Record<SeatState, string> = {
  hero: 'hero',
  active: 'in the hand',
  folded: 'folded',
  empty: 'empty seat',
};

/**
 * One seated player around the table (V2.1). Renders a clear presence per `state`: a premium glowing
 * hero, brighter in-hand players (active ring), dimmed folded silhouettes, and dashed empty seats —
 * so a full ring reads at a glance who is hero, who is in the hand, who folded, and where each sits.
 * Never renders hole cards for any seat. The hero glow is subtle and respects reduced-motion.
 */
export default function TableSeat({
  x,
  y,
  name,
  emoji,
  color,
  sub,
  position,
  action,
  state,
  anonymous,
  active,
  isDealer,
}: SeatProps & { x: number; y: number }) {
  const reduced = useReducedMotion();
  // Resolve the visual state. Legacy callers (no `state`) keep the prior look: gold ring iff `active`.
  const resolved: SeatState | 'neutral' = state ?? (active ? 'active' : 'neutral');
  const isHero = resolved === 'hero';
  const isActive = resolved === 'active';
  const isFolded = resolved === 'folded';
  const isEmpty = resolved === 'empty';
  const hasName = !!name?.trim();

  // Subtle pulsing hero glow (a11y: off under reduced-motion; static ring stays).
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (isHero && !reduced) {
      pulse.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      pulse.value = 0;
    }
  }, [isHero, reduced, pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.08 }],
  }));

  const inner = isEmpty ? (
    <PlayerSilhouette variant="empty" size={AVATAR} />
  ) : anonymous || !hasName ? (
    <PlayerSilhouette variant="present" size={AVATAR} />
  ) : (
    <Avatar name={name} emoji={emoji} color={color} size={AVATAR} />
  );

  const label = isEmpty ? 'Open' : hasName ? name : isHero ? 'You' : isActive ? 'In hand' : 'Folded';
  const a11y = [label, position ?? '', STATE_WORD[isEmpty ? 'empty' : isHero ? 'hero' : isActive ? 'active' : 'folded'], sub ?? '']
    .filter(Boolean)
    .join(', ');

  return (
    <View
      style={[styles.seat, { left: x - SEAT_W / 2, top: y - SEAT_W / 2 }, (isFolded || isEmpty) && styles.dimmed]}
      accessible
      accessibilityLabel={a11y}
    >
      <View style={styles.avatarWrap}>
        {isHero ? <Animated.View pointerEvents="none" style={[styles.heroGlow, glowStyle]} /> : null}
        <View
          style={[
            styles.ring,
            isHero && styles.ringHero,
            isActive && styles.ringActive,
          ]}
        >
          {inner}
        </View>
        {position && !isEmpty ? (
          <View style={styles.posPill}>
            <Text style={[styles.posText, isFolded && styles.posTextMuted]}>{position}</Text>
          </View>
        ) : null}
        {isDealer && !isEmpty ? <DealerButton style={styles.dealer} /> : null}
      </View>
      <Text style={[styles.name, isHero && styles.nameHero, (isFolded || isEmpty) && styles.nameMuted]} numberOfLines={1}>
        {label}
      </Text>
      {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
      {action ? <View style={styles.action}><ActionBadge action={action} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  seat: { position: 'absolute', width: SEAT_W, alignItems: 'center', gap: 2 },
  dimmed: { opacity: 0.5 },
  avatarWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  // Ring frame around the inner avatar/silhouette — transparent unless hero/active.
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringHero: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  ringActive: { borderColor: colors.goldMuted },
  // Soft animated halo behind the hero ring.
  heroGlow: {
    position: 'absolute',
    width: RING + 12,
    height: RING + 12,
    borderRadius: (RING + 12) / 2,
    borderWidth: 2,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  posPill: {
    position: 'absolute', top: -8, alignSelf: 'center', left: 0, right: 0,
    alignItems: 'center',
  },
  posText: {
    ...typography.caps, fontSize: 9, color: colors.backgroundDeep, overflow: 'hidden',
    backgroundColor: colors.goldLight, borderRadius: radii.pill, paddingHorizontal: 6, paddingVertical: 1,
  },
  posTextMuted: { color: colors.textMuted, backgroundColor: colors.surfaceHigh },
  dealer: { position: 'absolute', bottom: -4, right: -8 },
  name: { ...typography.labelSmall, fontSize: 11, color: colors.textHigh, maxWidth: SEAT_W, textAlign: 'center' },
  nameHero: { color: colors.goldLight },
  nameMuted: { color: colors.textMuted },
  sub: { ...typography.bodySmall, fontSize: 10, color: colors.goldLight },
  action: { marginTop: 2 },
});
