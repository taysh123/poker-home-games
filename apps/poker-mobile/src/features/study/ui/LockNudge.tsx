/**
 * Flag-adaptive lock / daily-limit affordance (Phase 1). ONE consistent surface for "daily free
 * limit reached" and "premium pack locked". HONESTY GATE: when the `paywall` flag is OFF there is
 * NO purchase path — only honest "coming soon" copy. When ON, it routes to the live PaywallScreen
 * (built in Subsystem 3). Lock state is conveyed by icon + text (never color alone).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { isFeatureEnabled } from '../../../config/features';
import type { RootStackParamList } from '../../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface LockNudgeProps {
  /** Heading, e.g. "Daily free limit reached" or "Premium pack". */
  title: string;
  /** Honest body shown when paywall is OFF (no purchase path). */
  comingSoonBody: string;
  /** Body shown above the Upgrade CTA when paywall is ON. */
  upgradeBody: string;
  /** Analytics/routing context passed to Paywall. */
  trigger: string;
  /** Icon — defaults to a lock. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

export default function LockNudge({ title, comingSoonBody, upgradeBody, trigger, icon = 'lock-closed' }: LockNudgeProps) {
  const navigation = useNavigation<Nav>();
  const paywallOn = isFeatureEnabled('paywall');
  const body = paywallOn ? upgradeBody : comingSoonBody;

  return (
    <Card style={styles.card}>
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${title}. ${body}`}
        style={styles.inner}
      >
        <View style={styles.head}>
          <Ionicons name={icon} size={18} color={colors.gold} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.body}>{body}</Text>
        {paywallOn && (
          <View style={styles.cta}>
            <PrimaryButton
              label="See Premium"
              variant="gradient"
              onPress={() => navigation.navigate('Paywall', { trigger })}
            />
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  inner: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h4, color: colors.text },
  body: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
  cta: { marginTop: spacing.sm },
});
