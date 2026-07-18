/**
 * Grounded references (Phase 4) — a standalone, honest library of the safe-to-assert claims the coach is
 * allowed to cite. It is NOT tied to any specific hand/analysis (CoachAnalysis carries no concept linkage —
 * a real boundary we do not paper over): the header says so explicitly. Read-only; flag-gated (`content`).
 *
 * Honesty: every line is the verbatim, caveat-bearing `assertion` (via the safe_to_assert gate in
 * logic/grounding.ts) + its verification tier + citation. Unsafe claims never appear. No fabrication.
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import StateView from '../../../components/StateView';
import Chip from '../../../components/Chip';
import { MotiView, slideUpSequence, staggerIn } from '../../../components/motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { iconSize } from '../../../theme/iconSize';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useCoachGrounding, type GroundedAssertion } from '../data/useCoachGrounding';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CoachGroundingScreen() {
  const navigation = useNavigation<Nav>();
  const reduced = useReducedMotion();
  const grounding = useCoachGrounding();
  const items = useMemo(() => grounding?.allAssertions() ?? [], [grounding]);

  return (
    <Screen animated>
      <BrandHeader variant="screen" title="Grounded references" subtitle="What the coach can cite" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StateView
          loading={false}
          isEmpty={items.length === 0}
          empty={<EmptyState ionicon="shield-checkmark-outline" title="No references yet" subtitle="Grounded references arrive with the content update." />}
        >
          {/* Honesty framing — these are general references, NOT analysis of any specific hand. */}
          <MotiView {...slideUpSequence({ reduced })}>
            <Card style={styles.intro}>
              <View style={styles.introHead}>
                <Ionicons name="information-circle-outline" size={iconSize.xs} color={colors.gold} />
                <Text style={styles.introTitle}>Reference facts, not hand advice</Text>
              </View>
              <Text style={styles.introBody}>
                These are general, source-cited facts the coach may quote — each labeled with its verification
                tier and caveat. They are not tailored to any specific hand you analyze.
              </Text>
              {grounding && <Text style={styles.introMeta}>{items.length} references · dataset {grounding.datasetVersion}</Text>}
            </Card>
          </MotiView>

          {items.map((item, i) => (
            <MotiView
              key={item.groundingId}
              {...slideUpSequence({ reduced, delay: staggerIn(i + 1) })}
              accessible
              accessibilityLabel={`${item.assertion}. Tier: ${item.tier || 'Reference'}.${item.citation ? ` Source: ${item.citation}.` : ''}`}
            >
              <ReferenceRow item={item} />
            </MotiView>
          ))}
        </StateView>
      </ScrollView>
    </Screen>
  );
}

function ReferenceRow({ item }: { item: GroundedAssertion }) {
  return (
    <Card style={styles.row}>
      <Text style={styles.assertion}>{item.assertion}</Text>
      <View style={styles.metaRow}>
        <TierChip tier={item.tier} />
        {!!item.citation && <Text style={styles.citation} numberOfLines={1}>{item.citation}</Text>}
      </View>
    </Card>
  );
}

/** Verification tier as a Chip — verbatim tier label; gold solid + shield for the strongest (Nash-Solved). */
function TierChip({ tier }: { tier: string }) {
  const t = tier.toLowerCase();
  if (t.includes('nash')) return <Chip label={tier} tone="gold" solid icon="shield-checkmark" />;
  if (t.includes('calibrated')) return <Chip label={tier} tone="gold" />;
  return <Chip label={tier || 'Reference'} tone="neutral" />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 120, gap: spacing.sm },
  intro: { gap: spacing.xs, marginBottom: spacing.xs },
  introHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  introTitle: { ...typography.label, color: colors.text },
  introBody: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
  introMeta: { ...typography.caps, color: colors.textDim, marginTop: spacing.xs },
  row: { gap: spacing.sm },
  assertion: { ...typography.body, color: colors.textHigh, lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  citation: { ...typography.bodySmall, color: colors.textMuted, flex: 1 },
});
