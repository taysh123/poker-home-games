import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';
import { radii } from '../../../theme/radii';
import type { BankrollPoint } from '../logic/bankrollAnalytics';

/**
 * Lightweight bankroll-over-time chart — dependency-free (no SVG/chart lib) to keep
 * the bundle lean. Renders the cumulative series as scaled vertical bars with a zero
 * baseline; gold above 0, muted/red below. A richer SVG chart can replace this later
 * without touching the analytics (`bankrollOverTime`).
 */
export default function BankrollChart({
  points,
  height = 120,
  maxBars = 40,
}: {
  points: BankrollPoint[];
  height?: number;
  maxBars?: number;
}) {
  if (points.length < 2) return <View style={[styles.empty, { height }]} />;

  const series = points.slice(-maxBars).map(p => p.cumulativeCents);
  const max = Math.max(...series, 0);
  const min = Math.min(...series, 0);
  const span = max - min || 1;
  // Vertical position of the zero baseline within the chart height.
  const zeroFromTop = (max / span) * height;

  return (
    <View style={[styles.wrap, { height }]}>
      <View style={[styles.baseline, { top: zeroFromTop }]} />
      <View style={styles.bars}>
        {series.map((v, i) => {
          const magnitude = (Math.abs(v) / span) * height;
          const positive = v >= 0;
          return (
            <View key={i} style={styles.col}>
              {positive ? (
                <View style={{ height: zeroFromTop }} />
              ) : null}
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(2, magnitude),
                    backgroundColor: positive ? colors.gold : colors.errorMuted,
                  },
                  positive ? styles.barUp : styles.barDown,
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', justifyContent: 'center' },
  empty: { width: '100%' },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'stretch', gap: 2 },
  col: { flex: 1, justifyContent: 'flex-start' },
  bar: { width: '100%', borderRadius: 2 },
  barUp: { alignSelf: 'flex-end' },
  barDown: { alignSelf: 'flex-start' },
});
