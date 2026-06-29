import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Chip, { type ChipTone } from '../../../components/Chip';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import type { InspectorView } from '../logic/inspector';

const TIER_TONE: Record<InspectorView['verificationTier'], ChipTone> = {
  solver: 'success',
  calibrated: 'gold',
  illustrative: 'neutral',
};

/** Thin renderer of the inspector view-model (the honesty gate is in logic/inspector.ts). */
export function InspectorBody({ view }: { view: InspectorView }) {
  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.hand}>{view.hand}</Text>
        <Chip label={view.verificationTier} tone={TIER_TONE[view.verificationTier]} size="sm" />
      </View>
      <Text style={styles.context}>{view.context}</Text>
      <Text style={styles.breadcrumb}>{view.breadcrumb.join(' › ')}</Text>

      <View style={styles.actions}>
        {view.actions.length === 0 ? (
          <Text style={styles.muted}>No data for this hand.</Text>
        ) : (
          view.actions.map((a) => (
            <View key={a.action} style={styles.actionRow}>
              <Text style={styles.actionLabel}>{a.action}</Text>
              <Text style={styles.actionFreq}>
                {a.freqPct}%{a.sizeBb ? ` · ${a.sizeBb}bb` : ''}
              </Text>
              {a.evBb !== undefined ? <Text style={styles.solver}>EV {a.evBb.toFixed(2)}bb</Text> : null}
              {a.equity !== undefined ? <Text style={styles.solver}>{Math.round(a.equity * 100)}% eq</Text> : null}
            </View>
          ))
        )}
      </View>

      <Text style={styles.meta}>{view.comboCount} combos</Text>
      {!view.hasSolverData ? (
        <Text style={styles.note}>Frequencies shown; EV/equity appear only in imported solver packs.</Text>
      ) : null}
      {view.diff ? (
        <Text style={styles.note}>Δ vs {view.diff.otherLabel}: {Math.round(view.diff.maxDelta * 100)}%</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  hand: { fontSize: 18, fontWeight: '800', color: colors.text },
  context: { fontSize: 12, color: colors.textHigh, marginBottom: 2 },
  breadcrumb: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm },
  actions: { gap: 4, marginBottom: spacing.sm },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionLabel: { fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'capitalize', width: 56 },
  actionFreq: { fontSize: 13, color: colors.textHigh },
  solver: { fontSize: 12, color: colors.goldLight },
  meta: { fontSize: 12, color: colors.textMuted },
  muted: { fontSize: 13, color: colors.textMuted },
  note: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
});
