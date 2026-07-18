import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import BrandHeader from '../components/BrandHeader';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import EmptyState from '../components/EmptyState';
import ProgressBar from '../components/ProgressBar';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as storage from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { useEngagement } from '../features/engagement/state/EngagementContext';
import { getMyAchievements } from '../api/achievementsApi';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Rarity accents. Common/Legendary/Rare map to design tokens (textMuted/gold/info);
// Epic purple has no DS token — kept as a local literal, matching StatsScreen's catalog.
const RARITY_COLORS: Record<string, string> = {
  Common: colors.textMuted, Rare: colors.info, Epic: '#C46EE8', Legendary: colors.gold,
};

interface Item {
  key: string; name: string; description: string; iconKey: string; rarity: string; earned: boolean;
}

interface Section { key: string; title: string; items: Item[]; }

/**
 * Achievements (V2.1 STEP 3.3) — merges SERVER session achievements (signed-in) with LOCAL pillar
 * achievements (study/bankroll/coach/play). Earned shown in rarity color; locked dimmed. Reachable
 * from Stats + Profile. Behind `retention`.
 */
export default function AchievementsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { localAchievements } = useEngagement();
  const reduced = useReducedMotion();
  const [serverItems, setServerItems] = useState<Item[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAchievements = useCallback(async () => {
    if (!user) { setServerItems([]); return; }
    try {
      const token = await storage.getItemAsync('accessToken');
      if (!token) return;
      const res = await getMyAchievements(token);
      const items: Item[] = [
        ...res.earned.map(a => ({ ...a, earned: true })),
        ...res.locked.map(a => ({ ...a, earned: false })),
      ];
      setServerItems(items);
    } catch { /* server achievements are best-effort; local still render */ }
    finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    void loadAchievements();
  }, [loadAchievements]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadAchievements();
  }, [loadAchievements]);

  const localItems: Item[] = localAchievements.map(a => ({
    key: a.key, name: a.name, description: a.description, iconKey: a.iconKey, rarity: a.rarity, earned: a.earned,
  }));

  const all = [...serverItems, ...localItems];
  const earned = all.filter(i => i.earned);
  const locked = all.filter(i => !i.earned);
  const earnedCount = earned.length;
  const total = all.length;

  const sections: Section[] = [
    earned.length > 0 ? { key: 'earned', title: 'UNLOCKED', items: earned } : null,
    locked.length > 0 ? { key: 'locked', title: 'LOCKED', items: locked } : null,
  ].filter(Boolean) as Section[];

  return (
    <Screen>
      <BrandHeader variant="screen" title="Achievements" subtitle={`${earnedCount} unlocked`} onBack={() => navigation.goBack()} />
      <FlatList
        data={sections}
        keyExtractor={(s) => s.key}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListHeaderComponent={
          total > 0 ? (
            <Card style={styles.progressCard}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Progress</Text>
                <Text style={styles.progressCount}>{earnedCount} / {total}</Text>
              </View>
              <ProgressBar
                value={total > 0 ? earnedCount / total : 0}
                style={styles.progressBar}
                accessibilityLabel={`${earnedCount} of ${total} achievements unlocked`}
              />
            </Card>
          ) : null
        }
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <SectionTitle>{section.title}</SectionTitle>
            <View style={styles.grid}>
              {section.items.map((it, i) => (
                <MotiView key={it.key} style={styles.badgeWrap} {...slideUpSequence({ reduced, delay: staggerIn(i, 30) })}>
                  <Badge item={it} />
                </MotiView>
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            ionicon="trophy-outline"
            title="No achievements yet"
            subtitle="Play, study, and analyze hands to start unlocking achievements."
          />
        }
      />
    </Screen>
  );
}

function Badge({ item }: { item: Item }) {
  const color = RARITY_COLORS[item.rarity] ?? colors.gold;
  return (
    <View
      style={styles.badgeFill}
      accessible
      accessibilityLabel={`${item.name}, ${item.rarity}, ${item.earned ? 'unlocked' : 'locked'}. ${item.description}`}
    >
      <Card style={StyleSheet.flatten([styles.badge, !item.earned && styles.badgeLocked])}>
        <View style={[styles.iconRing, { borderColor: color + '88', backgroundColor: color + '1A' }]}>
          <Ionicons name={(item.earned ? item.iconKey : 'lock-closed') as any} size={iconSize.md} color={item.earned ? color : colors.textDim} />
        </View>
        <Text style={styles.badgeName} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.rarity, { color }]}>{item.rarity}</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 60, flexGrow: 1 },
  progressCard: { gap: spacing.xs, marginBottom: spacing.lg },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { ...typography.caps, color: colors.textMuted },
  progressCount: { ...typography.label, color: colors.text, fontVariant: ['tabular-nums'] },
  progressBar: { marginTop: spacing.sm },
  section: { gap: spacing.sm, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgeWrap: { width: '31%' },
  badgeFill: { flex: 1 },
  badge: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  badgeLocked: { opacity: 0.45 },
  iconRing: { width: 56, height: 56, borderRadius: radii.lg, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  badgeName: { ...typography.labelSmall, color: colors.text, textAlign: 'center' },
  rarity: { ...typography.caps, fontSize: 9 },
});
