/**
 * Pack Catalog (PR #6) — content discovery surface. Lists content packs from the ContentStore (read-only,
 * via useContent().query; never the workbook), with locked/unlocked/coming-soon states driven by the
 * caller's entitlement. Flag-gated (`content`); honest empty state until packs are bundled.
 *
 * Honesty: `MarketableAs` is rendered VERBATIM (as the tier Chip label); the gold "Solver-Verified" treatment
 * (`Chip solid` + shield) appears ONLY for the gated `gto_verified` tier (PctVerifiedOrNash ≥ 95). Gating is
 * fail-closed. Pure join/label/availability logic lives in ../logic/marketableLabel.ts (unit-tested).
 * UI uses the design-system primitives (StateView / ListRow / Chip).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import EmptyState from '../../../components/EmptyState';
import StateView from '../../../components/StateView';
import ListRow from '../../../components/ListRow';
import Chip from '../../../components/Chip';
import PackTierChip from './PackTierChip';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { infoDialog } from '../../../utils/confirm';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useContent } from '../../../context/ContentContext';
import { useEntitlements } from '../../../context/EntitlementsContext';
import {
  buildPackCatalog,
  availabilityOf,
  type Pack,
  type PackAvailability,
} from '../logic/marketableLabel';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PackCatalogScreen() {
  const navigation = useNavigation<Nav>();
  const { enabled, isLoaded, query } = useContent();
  const { isPremium } = useEntitlements();
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isLoaded || !query) return;
    let cancelled = false;
    setError(false);
    setPacks(null);
    Promise.all([query.all('pack_manifests'), query.all('premium_content_catalog')])
      .then(([manifests, catalog]) => { if (!cancelled) setPacks(buildPackCatalog(manifests, catalog)); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isLoaded, query, reloadKey]);

  const loading = enabled && !error && (!isLoaded || packs === null);
  const ordered = useMemo(() => packs ?? [], [packs]);

  const onPress = (pack: Pack, availability: PackAvailability) => {
    if (availability === 'coming_soon') return infoDialog(pack.name, 'This pack is coming soon.');
    // Available + locked both open the detail screen (locked shows the upgrade CTA there).
    navigation.navigate('PackDetail', { packId: pack.id });
  };

  return (
    <Screen animated>
      <BrandHeader variant="screen" title="Content Packs" subtitle="Browse the curriculum" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StateView
          loading={loading}
          error={error}
          isEmpty={!enabled || ordered.length === 0}
          empty={<EmptyState ionicon="cube-outline" title="No packs yet" subtitle="Content packs arrive with the next update." />}
          onRetry={() => setReloadKey(k => k + 1)}
        >
          {ordered.map(pack => {
            const availability = availabilityOf(pack, isPremium);
            const locked = availability === 'locked';
            const comingSoon = availability === 'coming_soon';
            return (
              <ListRow
                key={pack.id}
                icon="cube-outline"
                title={pack.name}
                subtitle={[pack.tier, pack.difficulty, pack.estimatedHours && `~${pack.estimatedHours}h`].filter(Boolean).join(' · ')}
                dim={comingSoon}
                onPress={() => onPress(pack, availability)}
                accessibilityLabel={`${pack.name}, ${pack.marketableAs}${locked ? ', premium locked' : comingSoon ? ', coming soon' : ''}`}
                titleRight={
                  locked ? <Ionicons name="lock-closed" size={16} color={colors.gold} />
                  : comingSoon ? <Chip label="Soon" tone="neutral" />
                  : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                }
                chips={
                  <View style={styles.chipRow}>
                    <PackTierChip pack={pack} />
                    {locked && <Chip label="Premium" tone="gold" />}
                  </View>
                }
              />
            );
          })}
        </StateView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 120, gap: spacing.sm },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
