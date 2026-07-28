/**
 * Direction A — symmetric and quiet (owner-selected 2026-07-28).
 *
 * The two answer buttons share ONE style object so they cannot drift apart. This is a
 * correctness requirement, not a taste preference: styling "Yes" as a gold CTA and "Not really"
 * as a muted link manufactures the happy answer to farm five-star ratings, which is the
 * dark-pattern version of this feature. No gold, no icons, no illustration.
 *
 * Renders inside the shared components/BottomSheet primitive — reduced-motion, safe-area and
 * accessibilityViewIsModal all come from there. No new sheet chrome.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet from '../../../components/BottomSheet';
import PressableScale from '../../../components/motion/PressableScale';
import { colors } from '../../../theme/colors';
import { radii } from '../../../theme/radii';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';

type Props = {
  visible: boolean;
  onHappy: () => void;
  onUnhappy: () => void;
  onDismiss: () => void;
};

export default function SentimentSheet({ visible, onHappy, onUnhappy, onDismiss }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onDismiss} showHandle>
      <Text style={styles.question} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
        Enjoying T Poker?
      </Text>

      <View style={styles.row}>
        <PressableScale
          style={styles.choice}
          onPress={onUnhappy}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Not really"
        >
          <Text style={styles.choiceLabel} maxFontSizeMultiplier={1.3}>Not really</Text>
        </PressableScale>

        <PressableScale
          style={styles.choice}
          onPress={onHappy}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Yes"
        >
          <Text style={styles.choiceLabel} maxFontSizeMultiplier={1.3}>Yes</Text>
        </PressableScale>
      </View>

      <PressableScale
        style={styles.later}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Not now"
      >
        <Text style={styles.laterLabel} maxFontSizeMultiplier={1.3}>Not now</Text>
      </PressableScale>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  question: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  // ONE style for BOTH answers — symmetry is enforced structurally, not by convention.
  choice: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceLabel: { ...typography.label, color: colors.text },
  later: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  laterLabel: { ...typography.bodySmall, color: colors.textMuted },
});
