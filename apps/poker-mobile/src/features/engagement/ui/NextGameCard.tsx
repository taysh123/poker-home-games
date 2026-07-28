import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../../../components/motion';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { shadows } from '../../../theme/shadows';
import { iconSize } from '../../../theme/iconSize';
import { isFeatureEnabled } from '../../../config/features';
import { useStudy } from '../../study/state/StudyContext';
import { useNextGamePlan } from '../../../context/NextGamePlanContext';
import { crewSummary, gameDayLabel, isGameDay, isPlanStale, type NextGamePlan } from '../logic/nextGamePlan';
import { localDayKey } from '../../study/logic/localDay';
import { track } from '../../../utils/analytics';
import { confirmDialog } from '../../../utils/confirm';
import { showToast } from '../../../utils/toast';

/** Coarse player-count band for analytics — same buckets as the 2.4 plan/share events. */
const playersBand = (n: number): string => (n <= 1 ? '1' : n <= 3 ? '2-3' : n <= 5 ? '4-5' : '6+');

interface Props {
  /** Navigate to the right game-creation flow for the tree (guest: local wizard only). */
  onStart: (plan: NextGamePlan) => void;
  /** Navigate to the Spot Trainer warm-up (both trees: StudyTrainer { mode: 'spot' }). */
  onWarmUp: () => void;
}

/**
 * The pre-session moment (2.4): renders the single on-device next-game plan on Home/GuestHome.
 * Regular days show a quiet planned-game row; on game day it escalates ("GAME DAY" pill, gold
 * border) and adds the "Warm up" Study CTA. Renders nothing without a live plan — and guards
 * staleness at render time because GuestHome has no focus-refresh (mount-once entrance).
 */
export default function NextGameCard({ onStart, onWarmUp }: Props) {
  const { plan, clearNextGame } = useNextGamePlan();
  const { limitFor } = useStudy();
  // Re-evaluate "today" on every foreground: tab screens stay mounted (GuestHome especially has
  // no focus-refresh), so without this an app left open across midnight would miss the GAME DAY
  // escalation and keep a stale card (critic find m17).
  const [, setDayTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') setDayTick(t => t + 1); });
    return () => sub.remove();
  }, []);

  const today = localDayKey();
  if (!plan || isPlanStale(plan, today)) return null;

  // Honest against the SHARED daily practice pool (same rule as the drill cards): the count
  // reflects what's actually left today, and a spent pool hides the row entirely — no dead-end
  // tap into the limit nudge.
  const remaining = limitFor('practiceQuestion').remaining;
  const warmupHands = Math.min(10, remaining);

  const gameDay = isGameDay(plan, today);
  const crew = crewSummary(plan.crew);
  const dayLabel = gameDayLabel(plan.gameDay, today);
  const modeLabel = plan.mode === 'tournament' ? 'Tournament' : 'Cash game';
  // Dated tournament plans keep their mode visible (critic find m10).
  const sub = [dayLabel || modeLabel, dayLabel && plan.mode === 'tournament' ? 'Tournament' : '', crew]
    .filter(Boolean)
    .join(' · ');
  const band = playersBand(plan.crew.length);
  const startLabel = [
    gameDay ? 'Game night —' : 'Next game',
    !gameDay && dayLabel ? `on ${dayLabel}` : '',
    gameDay ? `start tonight's ${modeLabel.toLowerCase()}` : '',
    `with ${crew || 'your crew'}`,
    gameDay ? '' : '— start it',
  ].filter(Boolean).join(' ');

  function handleStart() {
    track('next_game_started', { mode: plan!.mode, players_band: band, is_game_day: gameDay });
    onStart(plan!);
  }

  function handleWarmUp() {
    track('next_game_warmup_tapped', { mode: plan!.mode });
    onWarmUp();
  }

  function handleDismiss() {
    confirmDialog(
      'Clear this plan?',
      Platform.OS === 'web'
        ? 'You can plan again from any finished game.'
        : 'The game-day reminder goes with it. You can plan again from any finished game.',
      'Clear',
      async () => {
        await clearNextGame();
        track('next_game_dismissed', { mode: plan!.mode, players_band: band });
        showToast('Plan cleared.', 'info');
      },
    );
  }

  return (
    <View style={[styles.card, gameDay && styles.cardGameDay]}>
      {/* Dismiss is a SIBLING of the main pressable — nesting Pressables lets a web tap on the ✕
          bubble into the card's start action. */}
      <View style={styles.mainRow}>
        <PressableScale
          style={styles.mainPress}
          onPress={handleStart}
          haptic="medium"
          accessibilityRole="button"
          accessibilityLabel={startLabel}
        >
          <View style={[styles.iconWrap, gameDay && styles.iconWrapGameDay]}>
            <Ionicons name="calendar-outline" size={iconSize.sm} color={gameDay ? colors.background : colors.gold} />
          </View>
          <View style={styles.text}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{gameDay ? 'Game night' : 'Next game'}</Text>
              {gameDay && (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>GAME DAY</Text>
                </View>
              )}
            </View>
            <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
          </View>
        </PressableScale>
        <PressableScale
          style={styles.dismissBtn}
          onPress={handleDismiss}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Clear the next game plan"
        >
          <Ionicons name="close" size={iconSize.xs} color={colors.textMuted} />
        </PressableScale>
      </View>
      {gameDay && isFeatureEnabled('study') && warmupHands > 0 && (
        <PressableScale
          style={styles.warmupRow}
          onPress={handleWarmUp}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={`Warm up — ${warmupHands} practice ${warmupHands === 1 ? 'hand' : 'hands'} before tonight`}
        >
          <Ionicons name="flash" size={iconSize.xs} color={colors.gold} />
          <Text style={styles.warmupText}>
            Warm up: {warmupHands} {warmupHands === 1 ? 'hand' : 'hands'} before tonight
          </Text>
          <Ionicons name="chevron-forward" size={iconSize.xs} color={colors.gold} />
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    marginBottom: spacing.md,
  },
  cardGameDay: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    ...shadows.goldSm,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.xs,
  },
  mainPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    minHeight: 72,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapGameDay: {
    backgroundColor: colors.gold,
  },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.label, color: colors.text },
  pill: {
    backgroundColor: colors.goldSubtle,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pillText: { fontSize: 10, fontWeight: '800', color: colors.gold, letterSpacing: 1.5 },
  sub: { ...typography.bodySmall, color: colors.textMuted },
  // A real ≥44pt box, not hitSlop — react-native-web's Pressable silently drops hitSlop, which
  // left a 28px ✕ flush against the start-game pressable on web (critic find C4).
  dismissBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  warmupText: { ...typography.bodySmall, color: colors.gold, fontWeight: '600', flex: 1 },
});
