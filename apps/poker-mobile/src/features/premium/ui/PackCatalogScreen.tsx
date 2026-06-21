/**
 * Pack Catalog (PR #6) — content discovery surface. Lists content packs from the ContentStore (read-only,
 * via useContent().query; never the workbook), with locked/unlocked/coming-soon states driven by the
 * caller's entitlement. Flag-gated (`content`); honest empty state until packs are bundled.
 *
 * Honesty: `MarketableAs` is rendered VERBATIM; the gold "Solver-Verified" treatment appears ONLY when the
 * pure gate (`verifiedBadge`, i.e. PctVerifiedOrNash ≥ 95) allows it. Gating is fail-closed (premium locked
 * unless entitled). Pure join/label/availability logic lives in ../logic/marketableLabel.ts (unit-tested).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import SkeletonRow from '../../../components/SkeletonRow';
import PressableScale from '../../../components/motion/PressableScale';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { infoDialog } from '../../../utils/confirm';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useContent } from '../../../context/ContentContext';
import { useEntitlements } from '../../../context/EntitlementsContext';
import {
  buildPackCatalog,
  availabilityOf,
  type Pack,
  type PackAvailability,
  type TierBadge,
} from '../logic/marketableLabel';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PackCatalogScreen() {
  const navigation = useNavigation<Nav>();
  const { enabled, isLoaded, query } = useContent();
  const { isPremium } = useEntitlements();
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isLoaded || !query) return;
    let cancelled = false;
    Promise.all([query.all('pack_manifests'), query.all('premium_content_catalog')])
      .then(([manifests, catalog]) => { if (!cancelled) setPacks(buildPackCatalog(manifests, catalog)); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isLoaded, query]);

  const loading = enabled && !error && (!isLoaded || packs === null);
  const ordered = useMemo(() => packs ?? [], [packs]);

  const onPress = (pack: Pack, availability: PackAvailability) => {
    if (availability === 'locked') {
      navigation.navigate('Paywall', { trigger: 'pack_catalog' });
      return;
    }
    if (availability === 'coming_soon') {
      infoDialog(pack.name, 'This pack is coming soon.');
      return;
    }
    // Available — discovery detail (no consume screen yet; show what's inside).
    const meta = [
      pack.difficulty && `Difficulty: ${pack.difficulty}`,
      pack.estimatedHours && `~${pack.estimatedHours}h`,
      pack.sourceSheets.length > 0 && `Includes: ${pack.sourceSheets.join(', ')}`,
    ].filter(Boolean).join('\n');
    infoDialog(pack.name, meta || pack.marketableAs);
  };

  return (
    <Screen>
      <BrandHeader variant="screen" title="Content Packs" subtitle="Browse the curriculum" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <EmptyState ionicon="alert-circle-outline" title="Couldn't load packs" subtitle="Please try again in a moment." />
        ) : loading ? (
          <>{[0, 1, 2, 3].map(i => <SkeletonRow key={i} isFirst={i === 0} />)}</>
        ) : !enabled || ordered.length === 0 ? (
          <EmptyState ionicon="cube-outline" title="No packs yet" subtitle="Content packs arrive with the next update." />
        ) : (
          ordered.map(pack => {
            const availability = availabilityOf(pack, isPremium);
            return <PackRow key={pack.id} pack={pack} availability={availability} onPress={() => onPress(pack, availability)} />;
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function PackRow({ pack, availability, onPress }: { pack: Pack; availability: PackAvailability; onPress: () => void }) {
  const locked = availability === 'locked';
  const comingSoon = availability === 'coming_soon';
  return (
    <PressableScale
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${pack.name}, ${pack.marketableAs}${locked ? ', premium locked' : comingSoon ? ', coming soon' : ''}`}
      onPress={onPress}
    >
      <Card style={[styles.row, comingSoon && styles.rowDim]}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>{pack.name}</Text>
          {locked ? (
            <Ionicons name="lock-closed" size={16} color={colors.gold} />
          ) : comingSoon ? (
            <Text style={styles.soon}>SOON</Text>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          )}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {[pack.tier, pack.difficulty, pack.estimatedHours && `~${pack.estimatedHours}h`].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.badges}>
          <TierLabel tierBadge={pack.tierBadge} text={pack.marketableAs} />
          {locked && <Text style={styles.premiumChip}>PREMIUM</Text>}
        </View>
      </Card>
    </PressableScale>
  );
}

/** Verbatim MarketableAs with tier-appropriate styling. Gold "verified" treatment only for the gated tier. */
function TierLabel({ tierBadge, text }: { tierBadge: TierBadge; text: string }) {
  const style =
    tierBadge === 'gto_verified' ? styles.tierGto
    : tierBadge === 'expert_calibrated' ? styles.tierCalibrated
    : styles.tierMuted;
  return (
    <View style={[styles.tier, style]}>
      {tierBadge === 'gto_verified' && <Ionicons name="shield-checkmark" size={11} color={colors.background} style={{ marginRight: 4 }} />}
      <Text style={[styles.tierText, tierBadge === 'gto_verified' && styles.tierTextGto]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 120, gap: spacing.sm },
  row: { gap: spacing.xs },
  rowDim: { opacity: 0.55 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { ...typography.h4, color: colors.text, flex: 1 },
  meta: { ...typography.bodySmall, color: colors.textMuted },
  soon: { ...typography.caps, color: colors.textMuted, fontSize: 10 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
  tier: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, overflow: 'hidden' },
  tierGto: { backgroundColor: colors.gold },
  tierCalibrated: { backgroundColor: colors.goldFaint, borderWidth: 1, borderColor: colors.goldMuted },
  tierMuted: { backgroundColor: colors.surfaceHigh },
  tierText: { ...typography.bodySmall, color: colors.textHigh, fontSize: 11 },
  tierTextGto: { color: colors.background, fontWeight: '600' },
  premiumChip: { ...typography.bodySmall, color: colors.gold, backgroundColor: colors.goldFaint, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2, fontSize: 10, overflow: 'hidden' },
});
