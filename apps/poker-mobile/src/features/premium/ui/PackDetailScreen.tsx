/**
 * Pack Detail (Phase B6) — a real detail surface for one content pack, sourced from the ContentStore
 * (pack_manifests ⋈ premium_content_catalog by PackID; never the workbook). Shows what's inside, verification
 * tier (verbatim, honesty-gated), availability, and an upgrade CTA for locked premium packs. Flag-gated.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import Chip from '../../../components/Chip';
import EmptyState from '../../../components/EmptyState';
import StateView from '../../../components/StateView';
import PrimaryButton from '../../../components/PrimaryButton';
import PackTierChip from './PackTierChip';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useContent } from '../../../context/ContentContext';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { buildPackCatalog, packById, availabilityOf, type Pack } from '../logic/marketableLabel';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'PackDetail'>;

export default function PackDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { packId } = route.params;
  const { enabled, isLoaded, query } = useContent();
  const { isPremium } = useEntitlements();
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isLoaded || !query) return;
    let cancelled = false;
    setError(false);
    setPack(null);
    Promise.all([query.all('pack_manifests'), query.all('premium_content_catalog')])
      .then(([m, c]) => { if (!cancelled) setPack(packById(buildPackCatalog(m, c), packId)); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isLoaded, query, packId, reloadKey]);

  const loading = enabled && !error && (!isLoaded || pack === null);
  const availability = useMemo(() => (pack ? availabilityOf(pack, isPremium) : null), [pack, isPremium]);
  const locked = availability === 'locked';
  const comingSoon = availability === 'coming_soon';

  return (
    <Screen animated>
      <BrandHeader variant="screen" title="Pack" subtitle={pack?.name ?? 'Content pack'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StateView
          loading={loading}
          error={error}
          isEmpty={!enabled || !pack}
          empty={<EmptyState ionicon="cube-outline" title="Pack not found" subtitle="It may not be in this content update." />}
          onRetry={() => setReloadKey(k => k + 1)}
        >
          {pack && (
            <>
              <Card variant="hero">
                <Text style={styles.name}>{pack.name}</Text>
                <View style={styles.chipRow}>
                  <PackTierChip pack={pack} />
                  {locked && <Chip label="Premium" tone="gold" />}
                  {comingSoon && <Chip label="Coming soon" tone="neutral" />}
                </View>
                <Text style={styles.meta}>
                  {[pack.tier, pack.difficulty, pack.estimatedHours && `~${pack.estimatedHours}h`,
                    pack.rowCount ? `${pack.rowCount} items` : null].filter(Boolean).join(' · ')}
                </Text>
              </Card>

              {pack.sourceSheets.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>WHAT'S INSIDE</Text>
                  {pack.sourceSheets.map(s => (
                    <View key={s} style={styles.insideRow}>
                      <Ionicons name="layers-outline" size={16} color={colors.gold} />
                      <Text style={styles.insideText} numberOfLines={1}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}

              {locked ? (
                <View style={styles.ctaWrap}>
                  <View style={styles.lockNote}>
                    <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                    <Text style={styles.lockText}>This pack is part of Premium.</Text>
                  </View>
                  <PrimaryButton label="See Premium" variant="gradient" onPress={() => navigation.navigate('Paywall', { trigger: 'pack_detail' })} />
                </View>
              ) : comingSoon ? (
                <View style={styles.lockNote}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.lockText}>This pack is coming in a future update.</Text>
                </View>
              ) : (
                <View style={styles.lockNote}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                  <Text style={styles.lockText}>Included — explore it from the Study tab.</Text>
                </View>
              )}
            </>
          )}
        </StateView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 120, gap: spacing.md },
  name: { ...typography.h3, color: colors.text },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm },
  meta: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.sm },
  section: { gap: spacing.xs },
  sectionLabel: { ...typography.caps, color: colors.textMuted, marginBottom: spacing.xs },
  insideRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  insideText: { ...typography.body, color: colors.textHigh, flex: 1 },
  ctaWrap: { gap: spacing.sm, marginTop: spacing.sm },
  lockNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  lockText: { ...typography.bodySmall, color: colors.textMuted },
});
