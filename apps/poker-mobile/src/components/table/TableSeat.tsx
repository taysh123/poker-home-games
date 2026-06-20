import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Avatar from '../Avatar';
import DealerButton from './DealerButton';
import ActionBadge from './ActionBadge';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radii } from '../../theme/radii';
import type { PokerPosition, PlayerAction } from '../../utils/pokerTable';

export interface SeatProps {
  name: string;
  emoji?: string;
  color?: string;
  /** Secondary line (chips / result / stack). */
  sub?: string;
  position?: PokerPosition;
  action?: PlayerAction;
  active?: boolean;
  isDealer?: boolean;
}

const SEAT_W = 76;

/**
 * One seated player around the table (V2.1 STEP 5.3). Position pill + Avatar + name + optional sub +
 * dealer marker + premium ActionBadge. Positions feel native to the seat. `x`/`y` are the seat center.
 */
export default function TableSeat({ x, y, name, emoji, color, sub, position, action, active, isDealer }: SeatProps & { x: number; y: number }) {
  const a11y = [name, position ? `${position} position` : '', action ? `action ${action}` : '', sub ?? '']
    .filter(Boolean)
    .join(', ');
  return (
    <View
      style={[styles.seat, { left: x - SEAT_W / 2, top: y - SEAT_W / 2 }]}
      accessible
      accessibilityLabel={a11y}
    >
      <View style={styles.avatarWrap}>
        <Avatar name={name} emoji={emoji} color={color} size={40} ring={active ? 'gold' : undefined} />
        {position ? (
          <View style={styles.posPill}><Text style={styles.posText}>{position}</Text></View>
        ) : null}
        {isDealer ? <DealerButton style={styles.dealer} /> : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
      {action ? <View style={styles.action}><ActionBadge action={action} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  seat: { position: 'absolute', width: SEAT_W, alignItems: 'center', gap: 2 },
  avatarWrap: { width: 40, height: 40 },
  posPill: {
    position: 'absolute', top: -8, alignSelf: 'center', left: 0, right: 0,
    alignItems: 'center',
  },
  posText: {
    ...typography.caps, fontSize: 9, color: colors.backgroundDeep, overflow: 'hidden',
    backgroundColor: colors.goldLight, borderRadius: radii.pill, paddingHorizontal: 6, paddingVertical: 1,
  },
  dealer: { position: 'absolute', bottom: -4, right: -8 },
  name: { ...typography.labelSmall, fontSize: 11, color: colors.textHigh, maxWidth: SEAT_W, textAlign: 'center' },
  sub: { ...typography.bodySmall, fontSize: 10, color: colors.goldLight },
  action: { marginTop: 2 },
});
