import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type Props = {
  steps: string[];
  /** 1-based current step */
  current: number;
};

/** Numbered step circles with connectors — used by the New Game wizards. */
export default function StepIndicator({ steps, current }: Props) {
  return (
    <View style={styles.stepIndicator}>
      {steps.map((label, i) => {
        const n = i + 1;
        const active = current === n;
        const done = current > n;
        return (
          <React.Fragment key={n}>
            {i > 0 && <View style={[styles.stepConnector, (done || active) && styles.stepConnectorActive]} />}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, active && styles.stepCircleActive, done && styles.stepCircleDone]}>
                {done
                  ? <Ionicons name="checkmark" size={13} color={colors.background} />
                  : <Text style={[styles.stepCircleText, active && styles.stepCircleTextActive]}>{String(n)}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepItem: { alignItems: 'center', gap: 6 },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 18,
    marginHorizontal: 4,
    maxWidth: 48,
  },
  stepConnectorActive: { backgroundColor: colors.gold },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.15)' },
  stepCircleDone: { borderColor: colors.gold, backgroundColor: colors.gold },
  stepCircleText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  stepCircleTextActive: { color: colors.gold },
  stepLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  stepLabelActive: { color: colors.gold },
});
