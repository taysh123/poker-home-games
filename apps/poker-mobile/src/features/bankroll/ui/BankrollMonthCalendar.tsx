import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { monthGridCells, WEEKDAY_INITIALS } from '../logic/monthGrid';
import { heatCellVisual, heatCellStyle, heatCellTextColor, dayCellLabel } from '../logic/heatCell';
import type { DayHeatLevel } from '../logic/calendar';

/**
 * Month calendar (B5). Plain RN cells rather than SVG because month days must be TAPPABLE —
 * the SVG house pattern (BankrollLineChart) is reserved for B6's non-tappable year grid, where
 * ~5px cells make per-day taps indefensible.
 *
 * Sign is carried by SHAPE (filled win vs hollow loss), not hue alone — see logic/heatCell.ts.
 * Static by construction, so it is reduced-motion safe without a check.
 *
 * The parent renders this FULL-BLEED: inside the screen's spacing.xl padding plus a default
 * Card the seven columns land at ~40px, under the 44x44 minimum.
 */
const MIN_TARGET = 44;

export default function BankrollMonthCalendar({
  monthKey,
  levels,
  onSelectDay,
}: {
  monthKey: string;
  levels: DayHeatLevel[];
  onSelectDay?: (dayKey: string) => void;
}) {
  const cells = useMemo(() => monthGridCells(monthKey), [monthKey]);
  const byDay = useMemo(() => new Map(levels.map(l => [l.dayKey, l])), [levels]);

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAY_INITIALS.map((w, i) => (
          // Decorative: every day cell already carries its full date in its own label, so
          // announcing seven bare letters first would only add noise.
          <Text
            key={i}
            style={styles.weekday}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((dayKey, i) => {
          if (!dayKey) return <View key={`pad-${i}`} style={styles.cell} />;
          const bucket = byDay.get(dayKey);
          const visual = heatCellVisual(bucket);
          const dayNumber = Number(dayKey.slice(8));
          return (
            <View key={dayKey} style={styles.cell}>
              <Pressable
                onPress={onSelectDay ? () => onSelectDay(dayKey) : undefined}
                disabled={!onSelectDay}
                accessibilityRole="button"
                accessibilityLabel={dayCellLabel(dayKey, dayNumber, bucket)}
                style={({ pressed }) => [
                  styles.cellInner,
                  heatCellStyle(visual),
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.dayNumber, { color: heatCellTextColor(visual) }]}>
                  {dayNumber}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Legend />
    </View>
  );
}

/**
 * Required by the heatmap's own accessibility mitigation — a signed ramp is not self-evident.
 * One composed label on the group; the swatches themselves are decorative.
 */
function Legend() {
  return (
    <View
      style={styles.legend}
      accessible
      accessibilityRole="text"
      accessibilityLabel="Legend. Filled gold is a winning day, a red outline is a losing day, a thin outline is break-even, and an empty cell means no session."
    >
      <LegendSwatch label="Won" swatch={{ backgroundColor: colors.goldMuted }} />
      <LegendSwatch label="Lost" swatch={{ borderColor: colors.error, borderWidth: 2 }} />
      <LegendSwatch label="Even" swatch={{ borderColor: colors.border, borderWidth: 1 }} />
      <LegendSwatch label="No game" swatch={{ borderColor: colors.textDim, borderWidth: 1, borderStyle: 'dashed' }} />
    </View>
  );
}

function LegendSwatch({ label, swatch }: { label: string; swatch: object }) {
  return (
    <View style={styles.legendItem} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.swatch, swatch]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    ...typography.caps,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // aspectRatio keeps cells square at any width; minHeight guarantees the 44px floor even on a
  // narrow device where 1/7th of the row would otherwise compute smaller.
  cell: { width: `${100 / 7}%`, aspectRatio: 1, minHeight: MIN_TARGET, padding: 2 },
  cellInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderColor: 'transparent',
  },
  pressed: { opacity: 0.6 },
  dayNumber: { ...typography.labelSmall },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 3, borderColor: 'transparent' },
  legendText: { ...typography.caption, color: colors.textMuted },
});
