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
import PressableScale from '../../../components/motion/PressableScale';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
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
  const { history, creditsRemaining, totalCredits, policyKind, signedIn } = useCoach();
  const showUpgrade = isFeatureEnabled('paywall') && policyKind === 'lifetime';
  const creditsLabel = !signedIn
    ? 'Sign in to use AI Coach'
    : policyKind === 'lifetime'
      ? (creditsRemaining > 0 ? `${creditsRemaining} free analysis` : 'Free analysis used')
      : `${creditsRemaining} / ${totalCredits} analyses this month`;

  return (
    <Screen animated>
      <BrandHeader variant="brand" title="AI Coach" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.disclaimer}>
          <Ionicons name="sparkles-outline" size={18} color={colors.gold} />
          <Text style={styles.disclaimerText}>
            Coaching feedback to help you learn — not solver output, and not presented as
            mathematically optimal.
          </Text>
        </Card>

        <View style={styles.creditsRow}>
          <Ionicons name="flash-outline" size={14} color={colors.textMuted} />
          <Text style={styles.creditsText}>{creditsLabel}</Text>
          {showUpgrade ? (
            <PressableScale onPress={() => navigation.navigate('Paywall')} hitSlop={8}>
              <Text style={styles.upgradeLink}> · Go Premium</Text>
            </PressableScale>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionTitle>ANALYZE A HAND</SectionTitle>
          {METHODS.map(m => (
            <PressableScale key={m.kind} onPress={() => navigation.navigate('CoachInput', { method: m.kind })} haptic="light">
              <Card style={styles.methodCard}>
                <View style={styles.methodIcon}>
                  <Ionicons name={m.icon} size={22} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>{m.title}</Text>
                  <Text style={styles.methodSub}>{m.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Card>
            </PressableScale>
          ))}
        </View>

        <View style={styles.section}>
          <SectionTitle>RECENT</SectionTitle>
          {history.length === 0 ? (
            <EmptyState ionicon="sparkles-outline" title="No analyses yet" subtitle="Analyze your first hand to get coaching feedback." />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {history.map(a => (
                <PressableScale key={a.id} onPress={() => navigation.navigate('CoachResult', { id: a.id })} haptic="light">
                  <Card padding={spacing.md} style={styles.histRow}>
                    <View style={styles.histIcon}>
                      <Ionicons name="sparkles" size={16} color={colors.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.histTitle} numberOfLines={1}>{a.inputSummary}</Text>
                      <Text style={styles.histSub}>{timeAgo(a.createdAt)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Card>
                </PressableScale>
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
  creditsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs },
  creditsText: { ...typography.bodySmall, color: colors.textMuted },
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
