import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import PokerTable from './PokerTable';
import TableSeat, { type SeatProps } from './TableSeat';
import Pot from './Pot';
import BetChip from './BetChip';
import { seatPositions, pointToward } from '../../utils/seatLayout';

/**
 * High-level immersive table building block (V2.1): a felt table with seated players placed via
 * seatPositions, an optional dealer seat, a center pot/custom node, committed "bet chips" in front of each
 * seat, and the hero's hole cards at the hero seat. Reusable foundation for training, session review, coach
 * examples, and a future hand replayer (NOT a full replayer itself).
 */
export default function TableScene({
  players,
  width,
  height,
  dealerSeat,
  potCents,
  potBb,
  center,
  heroCards,
  style,
}: {
  players: SeatProps[];
  width: number;
  height: number;
  dealerSeat?: number;
  potCents?: number;
  /** Pot in big blinds (study/training) — takes precedence over potCents for the center pot. */
  potBb?: number;
  center?: React.ReactNode;
  /** Hero's hole cards, rendered at the bottom hero seat (index 0). */
  heroCards?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const pts = seatPositions(players.length, { width, height });
  const tableCenter = { x: width / 2, y: height / 2 };
  const centerNode = potBb != null ? <Pot bb={potBb} /> : potCents != null ? <Pot amountCents={potCents} /> : center;

  return (
    <View style={style}>
      <PokerTable
        width={width}
        height={height}
        seats={
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Committed chips, drawn between each seat and the pot. */}
            {players.map((p, i) => {
              const hasBet = (p.committedBb ?? 0) > 0 || (p.committedCents ?? 0) > 0;
              if (!hasBet) return null;
              const spot = pointToward(pts[i], tableCenter, 0.42);
              return (
                <View key={`bet-${i}`} style={[styles.betLayer, { left: spot.x - 24, top: spot.y - 14 }]} pointerEvents="none">
                  <BetChip amountBb={p.committedBb} amountCents={p.committedCents} />
                </View>
              );
            })}
            {/* Seats. */}
            {players.map((p, i) => (
              <TableSeat key={i} x={pts[i].x} y={pts[i].y} {...p} isDealer={p.isDealer ?? i === dealerSeat} />
            ))}
            {/* Hero hole cards, in front of the hero seat. */}
            {heroCards && pts.length > 0 ? (
              <View
                style={[styles.heroCards, { left: pts[0].x - 60, top: pointToward(pts[0], tableCenter, 0.34).y - 30 }]}
                pointerEvents="none"
              >
                {heroCards}
              </View>
            ) : null}
          </View>
        }
      >
        {centerNode}
      </PokerTable>
    </View>
  );
}

const styles = StyleSheet.create({
  betLayer: { position: 'absolute', width: 48, alignItems: 'center' },
  heroCards: { position: 'absolute', width: 120, alignItems: 'center' },
});
