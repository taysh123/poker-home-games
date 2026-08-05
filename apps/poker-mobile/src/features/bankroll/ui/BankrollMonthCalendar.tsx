import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { monthGridCells, WEEKDAY_INITIALS } from '../logic/monthGrid';
import {
  heatCellVisual, heatCellStyle, heatCellTextColor, dayCellLabel,
} from '../logic/heatCell';
import type { DayHeatLevel } from '../logic/calendar';

/**
 * Month calendar (B5). Plain RN cells rather than SVG because month days must be able to be
 * TAPPABLE — the SVG house pattern (BankrollLineChart) is reserved for B6's year grid, where
 * ~5px cells make per-day taps indefensible. Static by construction, so reduced-motion safe
 * without a check.
 *
 * Sign is carried by SHAPE (filled win vs ringed loss), not hue alone — see logic/heatCell.ts,
 * where the contrast of every mark is measured and pinned.
 *
 * INTERACTIVITY IS CONDITIONAL. When `onSelectDay` is absent the cells are DATA, not controls,
 * so they render as plain Views. Shipping them as `disabled` Pressables with
 * accessibilityRole="button" offered a screen-reader user ~30 dead, "dimmed" buttons per month
 * and misreported non-interactive content as a control (WCAG 4.1.2). Day -> history filtering
 * arrives in B7; until then this grid is read-only and says so.
 *
 * TOUCH TARGET. The parent renders this FULL-BLEED: inside the screen's spacing.xl padding the
 * seven columns land at ~40px, under the 44x44 minimum. Even full-bleed the floor only holds
 * down to ~322dp of screen width — see the note on `cell` below. It is stated rather than
 * claimed away, because Android's Display-size setting shrinks effective dp for exactly the
 * low-vision users the rule protects.
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
          // Hidden on native; react-native-web implements NEITHER of these props, so on web the
          // seven letters are still announced. Left in place because they are correct where they
          // work, and the letters are legitimate (if redundant) content where they don't.
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
          const label = dayCellLabel(dayKey, dayNumber, bucket);
          const body = (
            <Text style={[styles.dayNumber, { color: heatCellTextColor(visual) }]}>
              {dayNumber}
            </Text>
          );

          return (
            <View key={dayKey} style={styles.cell}>
              {onSelectDay ? (
                <Pressable
                  onPress={() => onSelectDay(dayKey)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.cellInner,
                    heatCellStyle(visual),
                    pressed && styles.pressed,
                  ]}
                >
                  {body}
                </Pressable>
              ) : (
                <View
                  accessible
                  accessibilityLabel={label}
                  style={[styles.cellInner, heatCellStyle(visual)]}
                >
                  {body}
                </View>
              )}
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
 *
 * Every swatch is drawn by `heatCellStyle`, the same function the grid uses, so the legend
 * cannot teach a symbol the grid does not draw. It previously showed a dashed "No game" outline
 * that no cell ever rendered; "no session" is now explained in words, because its real
 * appearance is *nothing* and an invisible swatch explains nothing.
 *
 * The explanation is REAL TEXT rather than an accessibilityLabel on the container: on web,
 * accessibilityRole="text" is dropped by react-native-web and aria-label on the resulting
 * generic div is name-prohibited, so the sentence was unreachable on exactly the platform whose
 * a11y support is weakest.
 */
function Legend() {
  return (
    <View style={styles.legend}>
      <View style={styles.legendRow}>
        <LegendSwatch label="Won" visual={{ kind: 'win', step: 3 }} />
        <LegendSwatch label="Lost" visual={{ kind: 'loss', step: 2 }} />
        <LegendSwatch label="Broke even" visual={{ kind: 'even', step: 0 }} />
      </View>
      <Text style={styles.legendNote}>
        A filled day is a win, an outlined day is a loss, and a stronger mark means a bigger
        result. An empty square means no session that day.
      </Text>
    </View>
  );
}

function LegendSwatch({
  label,
  visual,
}: {
  label: string;
  visual: Parameters<typeof heatCellStyle>[0];
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, heatCellStyle(visual)]} />
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
  /**
   * 1px of separation, not 2 — every pixel here comes straight off the touch target, which is
   * `cellInner`, not this wrapper. Effective target = (screenWidth / 7) - 2, so the 44px floor
   * holds for screens >= ~322dp. Narrower than that (a 320dp device, or Android Display-size
   * "Largest") it degrades by a couple of points; 7 columns of 44px simply do not fit below
   * 308dp of usable width, so this is bounded and stated rather than papered over.
   */
  cell: { width: `${100 / 7}%`, padding: 1 },
  cellInner: {
    aspectRatio: 1,
    minHeight: MIN_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderColor: 'transparent',
  },
  pressed: { opacity: 0.6 },
  dayNumber: { ...typography.labelSmall },
  legend: { marginTop: spacing.md, gap: spacing.xs },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  legendText: { ...typography.caption, color: colors.textMuted },
  legendNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
});
