import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import Screen from '../components/Screen';
import BrandHeader from '../components/BrandHeader';
import PressableScale from '../components/motion/PressableScale';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { useAuth } from '../context/AuthContext';
import { isFeatureEnabled } from '../config/features';
import type { RootStackParamList } from '../navigation/AppNavigator';
import AllSessionsScreen from './AllSessionsScreen';
import StatsScreen from './StatsScreen';
import LocalSessionsScreen from './LocalSessionsScreen';
import GuestStatsScreen from './GuestStatsScreen';
import BankrollScreen from '../features/bankroll/ui/BankrollScreen';

type TrackSegment = 'bankroll' | 'sessions' | 'stats';
type Rt = RouteProp<RootStackParamList, 'Track'>;

const LABELS: Record<TrackSegment, string> = {
  bankroll: 'Bankroll',
  sessions: 'Sessions',
  stats: 'Stats',
};

/**
 * Track hub (V2.1 5-tab IA) — unifies Bankroll + Sessions + Stats behind one tab via an
 * in-screen segmented control. The existing screens render embedded (header suppressed);
 * the segment chosen by `route.params.segment` is honored so cross-nav lands on the right view.
 */
export default function TrackScreen() {
  const route = useRoute<Rt>();
  const { user } = useAuth();
  const isGuest = !user;

  const segments: TrackSegment[] = [
    ...(isFeatureEnabled('bankroll') ? (['bankroll'] as const) : []),
    'sessions',
    'stats',
  ];

  const initial: TrackSegment =
    route.params?.segment && segments.includes(route.params.segment)
      ? route.params.segment
      : segments[0];

  const [active, setActive] = useState<TrackSegment>(initial);

  return (
    <Screen>
      <BrandHeader variant="brand" title="Track" />

      <View style={styles.segmentRow}>
        {segments.map(seg => {
          const isActive = seg === active;
          return (
            <PressableScale
              key={seg}
              onPress={() => setActive(seg)}
              haptic="light"
              style={[styles.segBtn, isActive && styles.segBtnActive]}
            >
              <Text style={[styles.segText, isActive && styles.segTextActive]}>{LABELS[seg]}</Text>
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.body}>
        {active === 'bankroll' && <BankrollScreen embedded />}
        {active === 'sessions' && (isGuest ? <LocalSessionsScreen embedded /> : <AllSessionsScreen embedded />)}
        {active === 'stats' && (isGuest ? <GuestStatsScreen embedded /> : <StatsScreen embedded />)}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
  },
  segBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radii.sm },
  segBtnActive: { backgroundColor: colors.goldFaint },
  segText: { ...typography.labelSmall, color: colors.textMuted },
  segTextActive: { color: colors.gold },
  body: { flex: 1 },
});
