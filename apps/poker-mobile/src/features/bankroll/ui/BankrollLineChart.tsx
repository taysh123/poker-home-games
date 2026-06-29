import React, { useRef, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, ClipPath, Rect, Path, Line, Circle } from 'react-native-svg';
import { colors } from '../../../theme/colors';
import { formatCents, formatCentsSigned } from '../../../utils/money';
import type { BankrollPoint } from '../logic/bankrollAnalytics';

/**
 * Bankroll-over-time line chart (react-native-svg). Renders the cumulative series as a
 * single stroke with a subtle area fill, split at the ZERO BASELINE: gold above 0, red
 * below 0. The split is done with two clip rects (above / below the baseline) so the
 * colouring is exact at crossings without computing intersection points.
 *
 * - Zero is always inside the value domain, so the baseline + gold/red split are stable.
 * - Responsive: width is measured via onLayout (390px-safe); height reserves space to
 *   avoid layout shift while measuring.
 * - Static render (no required animation) — reduced-motion safe by construction.
 * - a11y: the container is an image with a one-line summary of the trend.
 */

let _uid = 0;

const INSET = { top: 12, bottom: 12, left: 3, right: 9 };

export default function BankrollLineChart({
  points,
  height = 168,
  accessibilityLabel,
}: {
  points: BankrollPoint[];
  height?: number;
  accessibilityLabel?: string;
}) {
  const [width, setWidth] = useState(0);
  const idRef = useRef<string>('');
  if (!idRef.current) idRef.current = `brl-${++_uid}`;
  const id = idRef.current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== width) setWidth(w);
  };

  const n = points.length;

  // a11y summary: net change across the series + the current bankroll.
  const label = (() => {
    if (accessibilityLabel) return accessibilityLabel;
    if (n === 0) return 'Bankroll over time chart, no sessions yet.';
    const last = points[n - 1].cumulativeCents;
    const start = points[0].cumulativeCents - points[0].netCents; // starting bankroll
    const change = last - start;
    const dir = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    return `Bankroll over time. ${dir} ${formatCentsSigned(change)} across ${n} session${n === 1 ? '' : 's'}, now ${formatCents(last)}.`;
  })();

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {width > 0 && n > 0 ? (
        <ChartBody id={id} points={points} width={width} height={height} />
      ) : null}
    </View>
  );
}

function ChartBody({
  id,
  points,
  width,
  height,
}: {
  id: string;
  points: BankrollPoint[];
  width: number;
  height: number;
}) {
  const n = points.length;
  const plotW = Math.max(1, width - INSET.left - INSET.right);
  const plotH = Math.max(1, height - INSET.top - INSET.bottom);

  const values = points.map(p => p.cumulativeCents);
  // Force 0 into the domain so the zero baseline is always visible + the gold/red
  // split is meaningful even when the series never crosses zero.
  const yMax = Math.max(0, ...values);
  const yMin = Math.min(0, ...values);
  const span = yMax - yMin || 1;

  const xFor = (i: number) => INSET.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yFor = (v: number) => INSET.top + ((yMax - v) / span) * plotH;
  const zeroY = yFor(0);

  const pt = (i: number) => `${xFor(i).toFixed(2)},${yFor(values[i]).toFixed(2)}`;
  const lineD = `M${points.map((_, i) => pt(i)).join(' L')}`;
  const areaD =
    `M${xFor(0).toFixed(2)},${zeroY.toFixed(2)} ` +
    `L${points.map((_, i) => pt(i)).join(' L')} ` +
    `L${xFor(n - 1).toFixed(2)},${zeroY.toFixed(2)} Z`;

  const lastV = values[n - 1];
  const lastX = xFor(n - 1);
  const lastY = yFor(lastV);
  const markerColor = lastV >= 0 ? colors.gold : colors.error;

  const aboveId = `${id}-above`;
  const belowId = `${id}-below`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <ClipPath id={aboveId}>
          <Rect x={0} y={0} width={width} height={Math.max(0, zeroY)} />
        </ClipPath>
        <ClipPath id={belowId}>
          <Rect x={0} y={zeroY} width={width} height={Math.max(0, height - zeroY)} />
        </ClipPath>
      </Defs>

      {/* Frame gridlines (subtle, low-contrast) */}
      <Line x1={INSET.left} y1={INSET.top} x2={INSET.left + plotW} y2={INSET.top} stroke={colors.border} strokeWidth={1} opacity={0.5} />
      <Line x1={INSET.left} y1={INSET.top + plotH} x2={INSET.left + plotW} y2={INSET.top + plotH} stroke={colors.border} strokeWidth={1} opacity={0.5} />

      {/* Area fill: gold above the baseline, red below */}
      <Path d={areaD} fill={colors.gold} fillOpacity={0.12} clipPath={`url(#${aboveId})`} />
      <Path d={areaD} fill={colors.error} fillOpacity={0.1} clipPath={`url(#${belowId})`} />

      {/* Zero baseline (the reference line) */}
      <Line
        x1={INSET.left}
        y1={zeroY}
        x2={INSET.left + plotW}
        y2={zeroY}
        stroke={colors.goldMuted}
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/* The line itself: gold above 0, red below 0 (same path, two clips) */}
      <Path d={lineD} stroke={colors.gold} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${aboveId})`} />
      <Path d={lineD} stroke={colors.error} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${belowId})`} />

      {/* Last-point marker (halo + dot) */}
      <Circle cx={lastX} cy={lastY} r={6} fill={markerColor} fillOpacity={0.22} />
      <Circle cx={lastX} cy={lastY} r={3.5} fill={markerColor} stroke={colors.background} strokeWidth={1.5} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', justifyContent: 'center' },
});
