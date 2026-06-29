import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
import PositionBadge from './PositionBadge';
import StackBadge from './StackBadge';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radii } from '../../theme/radii';
import { nameWritingDirection } from '../../utils/rtl';
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
  /** Stack readout — bb (study/training) or cents (cash/summary). */
  stackBb?: number;
  stackCents?: number;
  /** Chips committed this street — surfaced for a11y; the visible chip is drawn by TableScene. */
  committedBb?: number;
  committedCents?: number;
  /** This seat is the player to act (hero) — shows a "TO ACT" cue until an action is revealed. */
  isNext?: boolean;
  allin?: boolean;
  /** Legacy flag — gold ring. `state` supersedes this when provided. */
  active?: boolean;
  isDealer?: boolean;
  /** When set, the seat renders as a button (e.g. the live cash table — tap to record a buy-in/cash-out). */
  onPress?: () => void;
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
  stackBb,
  stackCents,
  committedBb,
  isNext,
  allin,
  active,
  isDealer,
  onPress,
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
  const showStack = !isEmpty && (stackBb != null || stackCents != null || allin);
  const showToAct = isNext && !action && !isEmpty;
  const stackWords = allin ? 'all in' : stackBb != null ? `${stackBb} big blinds` : '';
  const a11y = [
    label,
    position ?? '',
    STATE_WORD[isEmpty ? 'empty' : isHero ? 'hero' : isActive ? 'active' : 'folded'],
    showToAct ? 'to act' : '',
    committedBb ? `committed ${committedBb}bb` : '',
    stackWords,
    sub ?? '',
  ]
    .filter(Boolean)
    .join(', ');

  const seatStyle = [styles.seat, { left: x - SEAT_W / 2, top: y - SEAT_W / 2 }, (isFolded || isEmpty) && styles.dimmed];
  const body = (
    <>
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
        {position && !isEmpty ? <PositionBadge position={position} size="sm" style={styles.posBadge} /> : null}
        {isDealer && !isEmpty ? <DealerButton style={styles.dealer} /> : null}
      </View>
      <Text style={[styles.name, isHero && styles.nameHero, (isFolded || isEmpty) && styles.nameMuted, { writingDirection: nameWritingDirection(label) }]} numberOfLines={1}>
        {label}
      </Text>
      {showStack ? <StackBadge bb={stackBb} cents={stackCents} allin={allin} /> : null}
      {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
      {action ? (
        <View style={styles.action}><ActionBadge action={action} /></View>
      ) : showToAct ? (
        <View style={styles.toAct}><Text style={styles.toActText}>TO ACT</Text></View>
      ) : null}
    </>
  );

  // Tappable seat (live cash table) → a button; otherwise a static, accessible view.
  if (onPress) {
    return (
      <TouchableOpacity style={seatStyle} onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={a11y}>
        {body}
      </TouchableOpacity>
    );
  }

  return (
    <View style={seatStyle} accessible accessibilityLabel={a11y}>
      {body}
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
  posBadge: { position: 'absolute', top: -10, alignSelf: 'center' },
  dealer: { position: 'absolute', bottom: -4, right: -8 },
  name: { ...typography.labelSmall, fontSize: 11, color: colors.textHigh, maxWidth: SEAT_W, textAlign: 'center' },
  nameHero: { color: colors.goldLight },
  nameMuted: { color: colors.textMuted },
  sub: { ...typography.bodySmall, fontSize: 10, color: colors.goldLight },
  action: { marginTop: 2 },
  toAct: {
    marginTop: 2, backgroundColor: colors.goldSubtle, borderWidth: 1, borderColor: colors.goldMuted,
    borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 1,
  },
  toActText: { ...typography.caps, fontSize: 9, color: colors.goldLight },
});
