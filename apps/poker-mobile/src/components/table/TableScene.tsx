import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import PokerTable from './PokerTable';
import TableSeat, { type SeatProps } from './TableSeat';
import Pot from './Pot';
import { seatPositions } from '../../utils/seatLayout';

/**
 * High-level immersive table building block (V2.1 STEP 5.3): a felt table with seated players placed
 * via seatPositions, an optional dealer seat, a center pot or custom center node. Reusable foundation
 * for session review, training, coach examples (NOT a hand replayer).
 */
export default function TableScene({
  players,
  width,
  height,
  dealerSeat,
  potCents,
  center,
  style,
}: {
  players: SeatProps[];
  width: number;
  height: number;
  dealerSeat?: number;
  potCents?: number;
  center?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const pts = seatPositions(players.length, { width, height });
  return (
    <View style={style}>
      <PokerTable
        width={width}
        height={height}
        seats={
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {players.map((p, i) => (
              <TableSeat key={i} x={pts[i].x} y={pts[i].y} {...p} isDealer={p.isDealer ?? i === dealerSeat} />
            ))}
          </View>
        }
      >
        {potCents != null ? <Pot amountCents={potCents} /> : center}
      </PokerTable>
    </View>
  );
}
