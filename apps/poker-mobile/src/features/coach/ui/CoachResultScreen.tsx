import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import SectionTitle from '../../../components/SectionTitle';
import EmptyState from '../../../components/EmptyState';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import CrossPillarCTA from '../../../components/CrossPillarCTA';
import { isFeatureEnabled } from '../../../config/features';
import { useCoach } from '../state/CoachContext';
import type { CoachPoint } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'CoachResult'>;

export default function CoachResultScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { history } = useCoach();
  const analysis = history.find(a => a.id === route.params.id);

  if (!analysis) {
    return (
      <Screen>
        <BrandHeader variant="screen" title="Analysis" onBack={() => navigation.goBack()} />
        <EmptyState ionicon="sparkles-outline" title="Analysis not found" subtitle="It may have been cleared from recent history." />
      </Screen>
    );
  }

  return (
    <Screen>
      <BrandHeader variant="screen" title="Coaching" subtitle={analysis.inputSummary} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.demoBanner}>
          <Ionicons name="flask-outline" size={15} color={colors.warning} />
          <Text style={styles.demoText}>Demo Analysis — Not Live AI Yet</Text>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.chip}><Text style={styles.chipText}>{analysis.confidence} confidence</Text></View>
          <View style={styles.chip}><Text style={styles.chipText}>via {analysis.providerId}</Text></View>
        </View>

        <Card variant="hero">
          <Text style={styles.summaryLabel}>SUMMARY</Text>
          <Text style={styles.summary}>{analysis.summary}</Text>
        </Card>

        {analysis.mistakes.length > 0 && (
          <PointSection title="MISTAKES" icon="alert-circle" tint={colors.error} points={analysis.mistakes} />
        )}
        {analysis.goodDecisions.length > 0 && (
          <PointSection title="GOOD DECISIONS" icon="checkmark-circle" tint={colors.success} points={analysis.goodDecisions} />
        )}

        {analysis.alternativeLines.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>ALTERNATIVE LINES</SectionTitle>
            {analysis.alternativeLines.map((l, i) => (
              <Card key={i} padding={spacing.md} style={styles.altCard}>
                <Text style={styles.altLine}>{l.line}</Text>
                <Text style={styles.altWhy}>{l.rationale}</Text>
              </Card>
            ))}
          </View>
        )}

        {analysis.tips.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>COACHING TIPS</SectionTitle>
            <Card style={{ gap: spacing.sm }}>
              {analysis.tips.map((t, i) => (
                <View key={i} style={styles.tipRow}>
                  <Ionicons name="bulb-outline" size={16} color={colors.gold} />
                  <Text style={styles.tipText}>{t}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {isFeatureEnabled('retention') && isFeatureEnabled('study') && (
          <View style={{ marginTop: spacing.md }}>
            <CrossPillarCTA
              icon="school-outline"
              label="Drill this spot"
              sub="Practice the preflop decision in Study"
              onPress={() => navigation.navigate('StudyTrainer', { mode: 'spot' })}
            />
          </View>
        )}

        <View style={styles.disclaimerRow}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
          <Text style={styles.disclaimer}>{analysis.disclaimer}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function PointSection({ title, icon, tint, points }: {
  title: string; icon: React.ComponentProps<typeof Ionicons>['name']; tint: string; points: CoachPoint[];
}) {
  return (
    <View style={styles.section}>
      <SectionTitle>{title}</SectionTitle>
      {points.map((p, i) => (
        <Card key={i} padding={spacing.md} style={styles.pointCard}>
          <View style={styles.pointHead}>
            <Ionicons name={icon} size={16} color={tint} />
            <Text style={styles.pointTitle}>{p.title}</Text>
            {p.street ? <Text style={styles.pointStreet}>{p.street}</Text> : null}
          </View>
          <Text style={styles.pointDetail}>{p.detail}</Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 100, gap: spacing.lg },
  demoBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: 'rgba(243,156,18,0.12)', borderWidth: 1, borderColor: colors.warning,
    borderRadius: radii.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  demoText: { ...typography.labelSmall, color: colors.warning },
  metaRow: { flexDirection: 'row', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { ...typography.caps, color: colors.textMuted },
  summaryLabel: { ...typography.caps, color: colors.textMuted },
  summary: { ...typography.bodyLarge, color: colors.textHigh, marginTop: spacing.xs },
  section: { gap: spacing.sm },
  pointCard: { gap: spacing.xs },
  pointHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pointTitle: { ...typography.label, color: colors.text, flex: 1 },
  pointStreet: { ...typography.caps, color: colors.textMuted },
  pointDetail: { ...typography.body, color: colors.textMuted },
  altCard: { gap: spacing.xs },
  altLine: { ...typography.label, color: colors.gold },
  altWhy: { ...typography.body, color: colors.textMuted },
  tipRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  tipText: { ...typography.body, color: colors.textHigh, flex: 1 },
  disclaimerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingHorizontal: spacing.xs },
  disclaimer: { ...typography.bodySmall, color: colors.textMuted, flex: 1 },
});
