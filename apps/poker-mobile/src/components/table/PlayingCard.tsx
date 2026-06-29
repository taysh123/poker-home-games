import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radii } from '../../theme/radii';

/**
 * Polished playing card (V2.1 STEP 5.3) — shared rank+suit card for the table system. Promotes the
 * bespoke card from the Spot Trainer into one reusable component (trainer + future hands/replayers).
 */
const RED = new Set(['♥', '♦']);
const rankLabel = (r: string): string => (r === 'T' ? '10' : r);

export function PlayingCard({ rank, suit, size = 'md' }: { rank: string; suit: string; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? SM : MD;
  const red = RED.has(suit);
  return (
    <View style={[styles.card, dims.card]} accessibilityLabel={`${rankLabel(rank)} of ${suitName(suit)}`}>
      <Text style={[styles.rank, dims.rank, red && styles.red]}>{rankLabel(rank)}</Text>
      <Text style={[styles.suit, dims.suit, red && styles.red]}>{suit}</Text>
    </View>
  );
}

/** Two hole cards from a hand key like 'AKs' / 'AKo' / '99'. */
export function HoleCards({ hand, size = 'md' }: { hand: string; size?: 'sm' | 'md' }) {
  const [s1, s2] = suitsFor(hand);
  return (
    <View style={styles.hole}>
      <PlayingCard rank={hand[0]} suit={s1} size={size} />
      <PlayingCard rank={hand[1]} suit={s2} size={size} />
    </View>
  );
}

function suitsFor(hand: string): [string, string] {
  if (hand.length === 2) return ['♠', '♥'];        // pair → two suits
  return hand.endsWith('s') ? ['♠', '♠'] : ['♠', '♥']; // suited same / offsuit different
}
function suitName(s: string): string {
  return s === '♠' ? 'spades' : s === '♥' ? 'hearts' : s === '♦' ? 'diamonds' : 'clubs';
}

const MD = {
  card: { width: 64, height: 90 },
  rank: { fontSize: 26 },
  suit: { fontSize: 22 },
};
const SM = {
  card: { width: 44, height: 62 },
  rank: { fontSize: 18 },
  suit: { fontSize: 15 },
};

const styles = StyleSheet.create({
  hole: { flexDirection: 'row', gap: 8 },
  card: {
    borderRadius: radii.md,
    backgroundColor: '#F5F2E8',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  rank: { ...typography.amountLarge, color: '#1A1A1A' },
  suit: { color: '#1A1A1A', marginTop: -4 },
  red: { color: '#C0392B' },
});

export default PlayingCard;
