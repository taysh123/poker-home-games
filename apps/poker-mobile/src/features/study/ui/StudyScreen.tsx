import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import SectionTitle from '../../../components/SectionTitle';
import { PressableScale, AnimatedNumber, MotiView, slideUpSequence, staggerIn } from '../../../components/motion';
import ProgressBar from '../../../components/ProgressBar';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { iconSize } from '../../../theme/iconSize';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useStudy } from '../state/StudyContext';
import { studyStats } from '../logic/progress';
import { isFeatureEnabled } from '../../../config/features';
import TableBackdrop from '../../../components/table/TableBackdrop';
import { useContent } from '../../../context/ContentContext';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { buildPackCatalog, availabilityOf, type Pack } from '../../premium/logic/marketableLabel';
import LockNudge from './LockNudge';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const todayKey = () => new Date().toISOString().slice(0, 10);

export default function StudyScreen() {
  const navigation = useNavigation<Nav>();
  const { progress, dataset, setDailyGoal } = useStudy();
  const stats = studyStats(progress, todayKey());
  const goalPct = Math.min(1, progress.dailyGoal > 0 ? stats.answeredToday / progress.dailyGoal : 0);
  const retention = isFeatureEnabled('retention');
  const freezeTokens = progress.freezeTokens ?? 0;

  const { isLoaded: contentLoaded, query } = useContent();
  const { isPremium } = useEntitlements();
  const [packs, setPacks] = useState<Pack[] | null>(null);

  useEffect(() => {
    if (!contentLoaded || !query) return;
    let cancelled = false;
    Promise.all([query.all('pack_manifests'), query.all('premium_content_catalog')])
      .then(([m, c]) => { if (!cancelled) setPacks(buildPackCatalog(m, c)); })
      .catch(() => { if (!cancelled) setPacks([]); });
    return () => { cancelled = true; };
  }, [contentLoaded, query]);

  const lockedCount = (packs ?? []).filter(p => availabilityOf(p, isPremium) === 'locked').length;
  const unlockedCount = (packs ?? []).filter(p => availabilityOf(p, isPremium) === 'available').length;
  const showLibrary = isFeatureEnabled('content') && packs !== null && (lockedCount > 0 || unlockedCount > 0);

  return (
    <Screen animated>
      {isFeatureEnabled('immersive') && <TableBackdrop />}
      <BrandHeader variant="brand" title="Study" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isFeatureEnabled('solver') && (
          <PressableScale onPress={() => navigation.navigate('SolverWorkspace')} haptic="light" style={{ marginBottom: spacing.lg }} accessibilityRole="button" accessibilityLabel="Open Solver Workspace. Explore ranges, hover for detail, compare.">
            <Card variant="elevated">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons name="grid-outline" size={20} color={colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.h4, color: colors.text }}>Solver Workspace</Text>
                  <Text style={{ ...typography.bodySmall, color: colors.textMuted }}>Explore ranges · hover for detail · compare</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </View>
            </Card>
          </PressableScale>
        )}
        {/* Streak hero */}
        <Card variant="hero">
          <Text style={styles.heroLabel}>CURRENT STREAK</Text>
          <View style={styles.streakRow}>
            <AnimatedNumber value={progress.currentStreak} format={(n) => String(n)} style={styles.streakNum} />
            <Ionicons name="flame" size={iconSize.lg} color={colors.gold} style={styles.streakFlame} />
          </View>
          <Text style={styles.heroSub}>
            {progress.currentStreak === 0
              ? 'Train a spot today to start a streak'
              : `day${progress.currentStreak === 1 ? '' : 's'} in a row · best ${progress.longestStreak}`}
          </Text>

          {retention && freezeTokens > 0 && (
            <View style={styles.freezeChip}>
              <Ionicons name="snow-outline" size={12} color={colors.gold} />
              <Text style={styles.freezeText}>
                {freezeTokens} streak freeze{freezeTokens === 1 ? '' : 's'} ready
              </Text>
            </View>
          )}

          {/* Daily goal */}
          <View style={styles.goalWrap}>
            <ProgressBar
              value={goalPct}
              accessibilityLabel={stats.goalMetToday ? 'Daily goal met' : `${stats.answeredToday} of ${progress.dailyGoal} answered today`}
            />
            <View style={styles.goalRow}>
              {stats.goalMetToday ? (
                <View style={styles.goalMet}>
                  <Ionicons name="checkmark-circle" size={iconSize.xs} color={colors.success} />
                  <Text style={styles.goalText}>Daily goal met</Text>
                </View>
              ) : (
                <Text style={styles.goalText}>{stats.answeredToday} / {progress.dailyGoal} today</Text>
              )}
              {retention && (
                <View style={styles.stepper}>
                  <PressableScale
                    onPress={() => setDailyGoal(progress.dailyGoal - 1)}
                    haptic="light"
                    hitSlop={8}
                    style={styles.stepBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease daily goal"
                  >
                    <Ionicons name="remove" size={iconSize.xs} color={colors.gold} />
                  </PressableScale>
                  <Text style={styles.stepVal}>{progress.dailyGoal}</Text>
                  <PressableScale
                    onPress={() => setDailyGoal(progress.dailyGoal + 1)}
                    haptic="light"
                    hitSlop={8}
                    style={styles.stepBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Increase daily goal"
                  >
                    <Ionicons name="add" size={iconSize.xs} color={colors.gold} />
                  </PressableScale>
                </View>
              )}
            </View>
          </View>
        </Card>

        {/* Quick stats */}
        <View style={styles.statRow}>
          <Stat label="ACCURACY" value={stats.accuracyPct === null ? '—' : `${stats.accuracyPct.toFixed(0)}%`} />
          <Stat label="ANSWERED" value={String(progress.totalAnswered)} />
          <Stat label="SPOTS" value={String(dataset.ranges.length)} />
        </View>

        {/* Library summary */}
        {showLibrary && (
          <View style={styles.section}>
            <SectionTitle>LIBRARY</SectionTitle>
            <Card>
              <View style={styles.libRow}>
                <Ionicons name="lock-open-outline" size={18} color={colors.success} />
                <Text style={styles.libText}>{unlockedCount} pack{unlockedCount === 1 ? '' : 's'} unlocked</Text>
              </View>
              {lockedCount > 0 && (
                <View style={styles.libRow}>
                  <Ionicons name="lock-closed" size={18} color={colors.gold} />
                  <Text style={styles.libText}>{lockedCount} premium pack{lockedCount === 1 ? '' : 's'} {isFeatureEnabled('paywall') ? 'locked' : 'coming soon'}</Text>
                </View>
              )}
            </Card>
            {lockedCount > 0 && (
              <LockNudge
                title={isFeatureEnabled('paywall') ? 'Unlock the full library' : 'More packs on the way'}
                comingSoonBody="The 4 free packs are open now. Premium unlocks the full library — coming soon."
                upgradeBody="Unlock every study pack, all quizzes, and unlimited Spot Trainer."
                trigger="study_home_library"
                icon="library-outline"
              />
            )}
          </View>
        )}

        {/* Train CTAs */}
        <View style={styles.section}>
          <SectionTitle>TRAIN</SectionTitle>
          <TrainCard
            icon="flash"
            title="Spot Trainer"
            sub="A 10-spot quiz — score your reads"
            index={0}
            onPress={() => navigation.navigate('StudyTrainer', { mode: 'spot' })}
          />
          <TrainCard
            icon="repeat"
            title="Decision Trainer"
            sub="Continuous drilling — build instinct"
            index={1}
            onPress={() => navigation.navigate('StudyTrainer', { mode: 'decision' })}
          />
          {isFeatureEnabled('content') && (
            <TrainCard
              icon="book"
              title="Lessons"
              sub="Read study modules"
              index={2}
              onPress={() => navigation.navigate('LessonModules')}
            />
          )}
          {isFeatureEnabled('content') && (
            <TrainCard
              icon="help-circle"
              title="Quizzes"
              sub="Multiple-choice — test your reads"
              index={3}
              onPress={() => navigation.navigate('QuizRunner')}
            />
          )}
          {isFeatureEnabled('content') && (
            <TrainCard
              icon="cube"
              title="Content Packs"
              sub="Browse the curriculum"
              index={4}
              onPress={() => navigation.navigate('PackCatalog')}
            />
          )}
        </View>

        <View style={styles.noteRow}>
          <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
          <Text style={styles.note}>
            {dataset.name} — illustrative training ranges, not solver output. Real solver data can be imported later.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function TrainCard({ icon, title, sub, onPress, index = 0 }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string; onPress: () => void; index?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <MotiView {...slideUpSequence({ reduced, delay: staggerIn(index) })}>
      <PressableScale onPress={onPress} haptic="light" accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`}>
        <Card style={styles.trainCard}>
          <View style={styles.trainIcon}>
            <Ionicons name={icon} size={iconSize.md} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.trainTitle}>{title}</Text>
            <Text style={styles.trainSub}>{sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={iconSize.xs} color={colors.textMuted} />
        </Card>
      </PressableScale>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 140, gap: spacing.lg },
  heroLabel: { ...typography.caps, color: colors.textMuted },
  streakRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  streakNum: { ...typography.amountHero, color: colors.gold },
  streakFlame: { marginBottom: spacing.sm },
  heroSub: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.xs },
  goalWrap: { marginTop: spacing.lg, gap: spacing.sm },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalMet: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  goalText: { ...typography.bodySmall, color: colors.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 30, height: 30, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.goldFaint, borderWidth: 1, borderColor: colors.goldMuted,
  },
  stepVal: { ...typography.label, color: colors.text, minWidth: 20, textAlign: 'center' },
  freezeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: spacing.sm,
    backgroundColor: colors.goldFaint, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  freezeText: { ...typography.bodySmall, color: colors.gold, fontSize: 11 },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statValue: { ...typography.amount, color: colors.textHigh },
  statLabel: { ...typography.caps, color: colors.textMuted, marginTop: 2 },
  section: { gap: spacing.sm },
  trainCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  trainIcon: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center' },
  trainTitle: { ...typography.h4, color: colors.text },
  trainSub: { ...typography.bodySmall, color: colors.textMuted },
  noteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingHorizontal: spacing.xs },
  note: { ...typography.bodySmall, color: colors.textMuted, flex: 1 },
  libRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  libText: { ...typography.body, color: colors.textHigh },
});
