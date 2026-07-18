import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import SectionTitle from '../../../components/SectionTitle';
import EmptyState from '../../../components/EmptyState';
import ProgressBar from '../../../components/ProgressBar';
import { PressableScale, MotiView, AnimatedNumber, slideUpSequence, staggerIn } from '../../../components/motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { iconSize } from '../../../theme/iconSize';
import { timeAgo } from '../../../utils/formatters';
import { isFeatureEnabled } from '../../../config/features';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useCoach } from '../state/CoachContext';
import type { CoachInputKind } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const METHODS: { kind: CoachInputKind; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string }[] = [
  { kind: 'screenshot', icon: 'camera-outline', title: 'Screenshot', sub: 'Analyze a spot from an image' },
  { kind: 'hand_history', icon: 'document-text-outline', title: 'Paste hand history', sub: 'Drop a hand history to review' },
  { kind: 'manual', icon: 'create-outline', title: 'Manual spot', sub: 'Describe the hand yourself' },
];

export default function CoachScreen() {
  const navigation = useNavigation<Nav>();
  const reduced = useReducedMotion();
  const { history, creditsRemaining, totalCredits, policyKind, signedIn } = useCoach();
  const showUpgrade = isFeatureEnabled('paywall') && policyKind === 'lifetime';
  const creditsLabel = !signedIn
    ? 'Sign in to use AI Coach'
    : policyKind === 'lifetime'
      ? (creditsRemaining > 0 ? `${creditsRemaining} free analysis` : 'Free analysis used')
      : `${creditsRemaining} / ${totalCredits} analyses this month`;
  const remaining = Math.max(0, creditsRemaining);
  const showQuotaBar = signedIn && policyKind === 'monthly' && totalCredits > 0;
  const methods = METHODS.filter(m => m.kind !== 'screenshot' || isFeatureEnabled('coachScreenshot'));

  return (
    <Screen animated>
      <BrandHeader variant="brand" title="AI Coach" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MotiView {...slideUpSequence({ reduced })}>
          <View
            style={styles.demoBanner}
            accessible
            accessibilityRole="text"
            accessibilityLabel="Demo analysis — not live AI yet"
          >
            <Ionicons name="flask-outline" size={iconSize.xs} color={colors.warning} />
            <Text style={styles.demoText}>Demo Analysis — Not Live AI Yet</Text>
          </View>
        </MotiView>

        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(1) })}>
          <Card style={styles.disclaimer}>
            <Ionicons name="sparkles-outline" size={iconSize.sm} color={colors.gold} />
            <Text style={styles.disclaimerText}>
              Coaching feedback to help you learn — not solver output, and not presented as
              mathematically optimal.
            </Text>
          </Card>
        </MotiView>

        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(2) })}>
          <Card style={styles.creditCard}>
            <View style={styles.creditRow}>
              <View style={styles.creditIcon}>
                <Ionicons name="flash" size={iconSize.xs} color={colors.gold} />
              </View>
              {signedIn ? (
                <View style={styles.creditNum} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <AnimatedNumber
                    value={remaining}
                    format={(n) => String(Math.max(0, Math.round(n)))}
                    style={styles.creditValue}
                  />
                  {policyKind === 'monthly' && totalCredits > 0 ? (
                    <Text style={styles.creditOf}>/ {totalCredits}</Text>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.creditMain}>
                <Text style={[styles.creditText, !signedIn && styles.creditTextLead]} accessibilityLabel={creditsLabel}>
                  {creditsLabel}
                </Text>
              </View>
              {showUpgrade ? (
                <PressableScale
                  onPress={() => navigation.navigate('Paywall', { trigger: 'coach_upgrade' })}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Upgrade to Premium"
                >
                  <Text style={styles.upgradeLink}>Go Premium</Text>
                </PressableScale>
              ) : null}
            </View>
            {showQuotaBar ? (
              <ProgressBar
                value={remaining / totalCredits}
                style={styles.creditBar}
                accessibilityLabel={creditsLabel}
              />
            ) : null}
          </Card>
        </MotiView>

        <View style={styles.section}>
          <SectionTitle>ANALYZE A HAND</SectionTitle>
          {methods.map((m, i) => (
            <MotiView key={m.kind} {...slideUpSequence({ reduced, delay: staggerIn(i + 3) })}>
              <PressableScale
                onPress={() => navigation.navigate('CoachInput', { method: m.kind })}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={`${m.title}. ${m.sub}`}
              >
                <Card style={styles.methodCard}>
                  <View style={styles.methodIcon}>
                    <Ionicons name={m.icon} size={iconSize.md} color={colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>{m.title}</Text>
                    <Text style={styles.methodSub}>{m.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.textMuted} />
                </Card>
              </PressableScale>
            </MotiView>
          ))}
        </View>

        {isFeatureEnabled('content') && (
          <View style={styles.section}>
            <SectionTitle>REFERENCES</SectionTitle>
            <MotiView {...slideUpSequence({ reduced, delay: staggerIn(methods.length + 3) })}>
              <PressableScale
                onPress={() => navigation.navigate('CoachGrounding')}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel="Grounded references. Source-cited facts the coach can quote."
              >
                <Card style={styles.methodCard}>
                  <View style={styles.methodIcon}>
                    <Ionicons name="shield-checkmark-outline" size={iconSize.md} color={colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>Grounded references</Text>
                    <Text style={styles.methodSub}>Source-cited facts the coach can quote</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.textMuted} />
                </Card>
              </PressableScale>
            </MotiView>
          </View>
        )}

        <View style={styles.section}>
          <SectionTitle>RECENT</SectionTitle>
          {history.length === 0 ? (
            <EmptyState ionicon="sparkles-outline" title="No analyses yet" subtitle="Analyze your first hand to get coaching feedback." />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {history.map((a, i) => (
                <MotiView key={a.id} {...slideUpSequence({ reduced, delay: staggerIn(i) })}>
                  <PressableScale
                    onPress={() => navigation.navigate('CoachResult', { id: a.id })}
                    haptic="light"
                    accessibilityRole="button"
                    accessibilityLabel={`Open analysis: ${a.inputSummary}. ${timeAgo(a.createdAt)}.`}
                  >
                    <Card padding={spacing.md} style={styles.histRow}>
                      <View style={styles.histIcon}>
                        <Ionicons name="sparkles" size={iconSize.xs} color={colors.gold} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.histTitle} numberOfLines={1}>{a.inputSummary}</Text>
                        <Text style={styles.histSub}>{timeAgo(a.createdAt)}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={iconSize.xs} color={colors.textMuted} />
                    </Card>
                  </PressableScale>
                </MotiView>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 140, gap: spacing.lg },
  disclaimer: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  disclaimerText: { ...typography.bodySmall, color: colors.textMuted, flex: 1 },
  demoBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.warningFaint, borderWidth: 1, borderColor: colors.warning,
    borderRadius: radii.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  demoText: { ...typography.labelSmall, color: colors.warning },
  creditCard: { gap: spacing.md },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  creditIcon: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center' },
  creditNum: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  creditValue: { ...typography.amount, color: colors.text },
  creditOf: { ...typography.label, color: colors.textMuted },
  creditMain: { flex: 1 },
  creditText: { ...typography.bodySmall, color: colors.textMuted },
  creditTextLead: { ...typography.label, color: colors.textHigh },
  creditBar: { marginTop: spacing.xs },
  upgradeLink: { ...typography.labelSmall, color: colors.gold },
  section: { gap: spacing.sm },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  methodIcon: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center' },
  methodTitle: { ...typography.h4, color: colors.text },
  methodSub: { ...typography.bodySmall, color: colors.textMuted },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  histIcon: { width: 32, height: 32, borderRadius: radii.sm, backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center' },
  histTitle: { ...typography.label, color: colors.text },
  histSub: { ...typography.bodySmall, color: colors.textMuted },
});
