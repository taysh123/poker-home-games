import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HoverCard from '../../../components/HoverCard';
import { colors } from '../../../theme/colors';
import type { PreflopRange } from '../../study/types';
import { buildInspectorView } from '../logic/inspector';
import { RANKS, handAt } from '../logic/grid';
import type { SolverRange, VerificationTier } from '../pack/types';
import { RangeCell } from './RangeCell';
import { InspectorBody } from './HandInspector';

interface Props {
  range: PreflopRange | SolverRange;
  tier: VerificationTier;
  selectedHand?: string;
  compareTo?: PreflopRange | SolverRange;
  onSelectHand: (hand: string) => void;
  cellSize?: number;
}

/**
 * 13×13 range grid with rank headers (row + column) and a web hover inspector per cell (focus-accessible via
 * Tab → HoverCard onFocus). On mobile the hover popover is a no-op; the parent opens a DetailSheet on press.
 */
function RangeGrid({ range, tier, selectedHand, compareTo, onSelectHand, cellSize = 30 }: Props) {
  return (
    <View>
      <View style={styles.row}>
        <View style={{ width: cellSize, height: cellSize }} />
        {RANKS.map(rk => (
          <View key={`col-${rk}`} style={[styles.header, { width: cellSize, height: cellSize }]}>
            <Text style={styles.headerText}>{rk}</Text>
          </View>
        ))}
      </View>
      {RANKS.map((rowRk, r) => (
        <View key={`row-${rowRk}`} style={styles.row}>
          <View style={[styles.header, { width: cellSize, height: cellSize }]}>
            <Text style={styles.headerText}>{rowRk}</Text>
          </View>
          {RANKS.map((_, c) => {
            const hand = handAt(r, c);
            return (
              <HoverCard
                key={hand}
                renderContent={() => <InspectorBody view={buildInspectorView(range, hand, { tier, compareTo })} />}
              >
                <RangeCell
                  hand={hand}
                  mix={range.strategy[hand] ?? []}
                  selected={selectedHand === hand}
                  size={cellSize}
                  onPress={() => onSelectHand(hand)}
                />
              </HoverCard>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default React.memo(RangeGrid);

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  header: { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  headerText: { fontSize: 10, color: colors.textHigh, fontWeight: '700' },
});
