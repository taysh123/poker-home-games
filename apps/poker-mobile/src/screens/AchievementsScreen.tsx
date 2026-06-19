import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import BrandHeader from '../components/BrandHeader';
import Card from '../components/Card';
import SectionTitle from '../components/SectionTitle';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import * as storage from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { useEngagement } from '../features/engagement/state/EngagementContext';
import { getMyAchievements } from '../api/achievementsApi';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const RARITY_COLORS: Record<string, string> = {
  Common: colors.textMuted, Rare: '#4EAADC', Epic: '#C46EE8', Legendary: colors.gold,
};

interface Item {
  key: string; name: string; description: string; iconKey: string; rarity: string; earned: boolean;
}

/**
 * Achievements (V2.1 STEP 3.3) — merges SERVER session achievements (signed-in) with LOCAL pillar
 * achievements (study/bankroll/coach/play). Earned shown in rarity color; locked dimmed. Reachable
 * from Stats + Profile. Behind `retention`.
 */
export default function AchievementsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { localAchievements } = useEngagement();
  const [serverItems, setServerItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setServerItems([]); return; }
    (async () => {
      try {
        const token = await storage.getItemAsync('accessToken');
        if (!token) return;
        const res = await getMyAchievements(token);
        if (cancelled) return;
        const items: Item[] = [
          ...res.earned.map(a => ({ ...a, earned: true })),
          ...res.locked.map(a => ({ ...a, earned: false })),
        ];
        setServerItems(items);
      } catch { /* server achievements are best-effort; local still render */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const localItems: Item[] = localAchievements.map(a => ({
    key: a.key, name: a.name, description: a.description, iconKey: a.iconKey, rarity: a.rarity, earned: a.earned,
  }));

  const all = [...serverItems, ...localItems];
  const earned = all.filter(i => i.earned);
  const locked = all.filter(i => !i.earned);
  const earnedCount = earned.length;

  return (
    <Screen>
      <BrandHeader variant="screen" title="Achievements" subtitle={`${earnedCount} unlocked`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {earned.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>UNLOCKED</SectionTitle>
            <View style={styles.grid}>
              {earned.map(i => <Badge key={i.key} item={i} />)}
            </View>
          </View>
        )}
        {locked.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>LOCKED</SectionTitle>
            <View style={styles.grid}>
              {locked.map(i => <Badge key={i.key} item={i} />)}
            </View>
          </View>
        )}
        {all.length === 0 && (
          <Text style={styles.empty}>Play, study, and analyze hands to start unlocking achievements.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function Badge({ item }: { item: Item }) {
  const color = RARITY_COLORS[item.rarity] ?? colors.gold;
  return (
    <View
      style={styles.badgeWrap}
      accessible
      accessibilityLabel={`${item.name}, ${item.rarity}, ${item.earned ? 'unlocked' : 'locked'}. ${item.description}`}
    >
      <Card style={[styles.badge, !item.earned && styles.badgeLocked]}>
        <View style={[styles.iconRing, { borderColor: color + '88', backgroundColor: color + '1A' }]}>
          <Ionicons name={(item.earned ? item.iconKey : 'lock-closed') as any} size={26} color={item.earned ? color : colors.textDim} />
        </View>
        <Text style={styles.badgeName} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.rarity, { color }]}>{item.rarity}</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 60, gap: spacing.lg },
  section: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgeWrap: { width: '31%' },
  badge: { alignItems: 'center', gap: 6, paddingVertical: spacing.md },
  badgeLocked: { opacity: 0.45 },
  iconRing: { width: 56, height: 56, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  badgeName: { ...typography.labelSmall, color: colors.text, textAlign: 'center' },
  rarity: { ...typography.caps, fontSize: 9 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
});
