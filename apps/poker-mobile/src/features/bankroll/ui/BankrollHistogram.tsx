import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import { colors } from '../../../theme/colors';
import type { NetHistogramBin } from '../logic/bankrollAnalytics';

/**
 * Session-net distribution histogram (react-native-svg). One bar per bucket from
 * `sessionNetHistogram`; bar height ∝ count. Buckets on the losing side (midpoint < 0)
 * are red, winning side gold, and a dashed divider marks the zero crossing — so the
 * shape reads as "how often I win vs lose, and by how much" without relying on colour
 * alone. Responsive width via onLayout; static (reduced-motion safe).
 */
export default function BankrollHistogram({
  bins,
  height = 96,
  accessibilityLabel,
}: {
  bins: NetHistogramBin[];
  height?: number;
  accessibilityLabel?: string;
}) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== width) setWidth(w);
  };

  const n = bins.length;
  const totalSessions = bins.reduce((s, b) => s + b.count, 0);
  const losing = bins.filter(b => (b.fromCents + b.toCents) / 2 < 0).reduce((s, b) => s + b.count, 0);
  const winning = totalSessions - losing;
  const label =
    accessibilityLabel ??
    `Session result distribution: ${winning} winning, ${losing} losing across ${totalSessions} session${totalSessions === 1 ? '' : 's'}.`;

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {width > 0 && n > 0 ? <HistogramBody bins={bins} width={width} height={height} /> : null}
    </View>
  );
}

const PAD = { top: 6, bottom: 4 };
const GAP = 4;

function HistogramBody({ bins, width, height }: { bins: NetHistogramBin[]; width: number; height: number }) {
  const n = bins.length;
  const plotH = Math.max(1, height - PAD.top - PAD.bottom);
  const maxCount = Math.max(1, ...bins.map(b => b.count));
  const barW = Math.max(2, (width - GAP * (n - 1)) / n);

  // Boundary x between the last losing bucket and the first winning bucket (for the divider).
  const firstWinIdx = bins.findIndex(b => (b.fromCents + b.toCents) / 2 >= 0);
  const dividerX = firstWinIdx > 0 ? firstWinIdx * (barW + GAP) - GAP / 2 : null;

  return (
    <Svg width={width} height={height}>
      {bins.map((b, i) => {
        const x = i * (barW + GAP);
        const barH = (b.count / maxCount) * plotH;
        const losing = (b.fromCents + b.toCents) / 2 < 0;
        const fill = losing ? colors.error : colors.gold;
        // Always draw a faint baseline tick so empty buckets keep the axis continuous.
        const h = Math.max(2, barH);
        const y = PAD.top + plotH - h;
        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={3}
            fill={fill}
            fillOpacity={b.count === 0 ? 0.18 : 0.85}
          />
        );
      })}
      {dividerX != null ? (
        <Line
          x1={dividerX}
          y1={0}
          x2={dividerX}
          y2={height}
          stroke={colors.goldMuted}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ) : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', justifyContent: 'flex-end' },
});
