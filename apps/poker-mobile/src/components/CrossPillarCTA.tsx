import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import PressableScale from './motion/PressableScale';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';

/**
 * Cross-pillar loop CTA (V2.1 STEP 3.5) — a consistent "next step" card that links one pillar to
 * another (e.g. game → bankroll, coach → study). Callers gate visibility on `retention` + the
 * destination pillar flag.
 */
export default function CrossPillarCTA({
  icon, label, sub, onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} haptic="light" accessibilityRole="button" accessibilityLabel={`${label}. ${sub}`}>
      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={colors.gold} />
        </View>
        <View style={styles.text}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.sub}>{sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: colors.goldMuted },
  iconWrap: {
    width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.goldFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  label: { ...typography.label, color: colors.text },
  sub: { ...typography.bodySmall, color: colors.textMuted },
});
