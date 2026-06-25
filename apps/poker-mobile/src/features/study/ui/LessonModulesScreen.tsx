/**
 * Lesson Modules (PR #3) — lists learning modules from the ContentStore (read-only, via useContent().query;
 * never the workbook). Flag-gated (`content`); honest empty state until real content lands. UI uses the
 * design-system primitives (StateView / ListRow).
 *
 * Task 9: loads pack_manifests + premium_content_catalog alongside learning_modules to derive per-module
 * lock state via availabilityOf(pack, isPremium). Modules with no PackID or a free pack are treated as
 * available (fail-open). Locked → lock icon + navigate Paywall; coming_soon → Soon Chip; else → LessonReader.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import EmptyState from '../../../components/EmptyState';
import StateView from '../../../components/StateView';
import ListRow from '../../../components/ListRow';
import Chip from '../../../components/Chip';
import { spacing } from '../../../theme/spacing';
import { colors } from '../../../theme/colors';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useContent } from '../../../context/ContentContext';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { toModules, type LessonModule } from '../logic/lessons';
import { buildPackCatalog, availabilityOf, packById, type Pack } from '../../premium/logic/marketableLabel';
import { isFeatureEnabled } from '../../../config/features';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LessonModulesScreen() {
  const navigation = useNavigation<Nav>();
  const { enabled, isLoaded, query } = useContent();
  const { isPremium } = useEntitlements();
  const [modules, setModules] = useState<LessonModule[] | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [modulePackIds, setModulePackIds] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isLoaded || !query) return;
    let cancelled = false;
    setError(false);
    setModules(null);
    Promise.all([
      query.all('learning_modules'),
      query.all('pack_manifests'),
      query.all('premium_content_catalog'),
    ])
      .then(([moduleRows, manifests, catalog]) => {
        if (cancelled) return;
        setModules(toModules(moduleRows));
        setPacks(buildPackCatalog(manifests, catalog));
        // stash module→PackID map for the join
        setModulePackIds(Object.fromEntries(moduleRows.map(r => [String(r['ModuleID'] ?? ''), String(r['PackID'] ?? '')])));
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isLoaded, query, reloadKey]);

  const loading = enabled && !error && (!isLoaded || modules === null);

  // Fail-open: if no PackID or pack not found, treat as available (lessons not sold individually).
  const availabilityForModule = (moduleId: string) => {
    const packId = modulePackIds[moduleId];
    if (!packId) return 'available' as const;
    const pack = packById(packs, packId);
    return pack ? availabilityOf(pack, isPremium) : ('available' as const);
  };

  return (
    <Screen animated>
      <BrandHeader variant="screen" title="Lessons" subtitle="Study modules" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StateView
          loading={loading}
          error={error}
          isEmpty={!enabled || !modules || modules.length === 0}
          empty={<EmptyState ionicon="book-outline" title="No lessons yet" subtitle="Lessons arrive with the next content update." action={{ label: 'Try the Spot Trainer', onPress: () => navigation.navigate('StudyTrainer', { mode: 'spot' }) }} />}
          onRetry={() => setReloadKey(k => k + 1)}
        >
          {(modules ?? []).map(m => {
            const availability = availabilityForModule(m.moduleId);
            const locked = availability === 'locked';
            const comingSoon = availability === 'coming_soon';
            return (
              <ListRow
                key={m.moduleId}
                icon="book-outline"
                title={m.moduleName || m.moduleId}
                titleLines={2}
                dim={comingSoon}
                onPress={
                  locked
                    ? (isFeatureEnabled('paywall') ? () => navigation.navigate('Paywall', { trigger: 'lesson_locked' }) : undefined)
                    : comingSoon
                      ? undefined
                      : () => navigation.navigate('LessonReader', { moduleId: m.moduleId, moduleName: m.moduleName })
                }
                accessibilityLabel={`Open lesson module ${m.moduleName || m.moduleId}${locked ? ', premium locked' : comingSoon ? ', coming soon' : ''}`}
                titleRight={
                  locked
                    ? <Ionicons name="lock-closed" size={16} color={colors.gold} />
                    : comingSoon
                      ? <Chip label="Soon" tone="neutral" />
                      : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
});
