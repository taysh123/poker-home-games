import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import SectionTitle from '../../../components/SectionTitle';
import PressableScale from '../../../components/motion/PressableScale';
import AnimatedNumber from '../../../components/motion/AnimatedNumber';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useStudy } from '../state/StudyContext';
import { studyStats } from '../logic/progress';
import { isFeatureEnabled } from '../../../config/features';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const todayKey = () => new Date().toISOString().slice(0, 10);

export default function StudyScreen() {
  const navigation = useNavigation<Nav>();
  const { progress, dataset, setDailyGoal } = useStudy();
  const stats = studyStats(progress, todayKey());
  const goalPct = Math.min(1, progress.dailyGoal > 0 ? stats.answeredToday / progress.dailyGoal : 0);
  const retention = isFeatureEnabled('retention');
  const freezeTokens = progress.freezeTokens ?? 0;

  return (
    <Screen animated>
      <BrandHeader variant="brand" title="Study" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Streak hero */}
        <Card variant="hero">
          <Text style={styles.heroLabel}>CURRENT STREAK</Text>
          <View style={styles.streakRow}>
            <AnimatedNumber value={progress.currentStreak} format={(n) => String(n)} style={styles.streakNum} />
            <Text style={styles.streakFlame}>🔥</Text>
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
            <View style={styles.goalTrack}>
              <View style={[styles.goalFill, { width: `${goalPct * 100}%` }]} />
            </View>
            <View style={styles.goalRow}>
              <Text style={styles.goalText}>
                {stats.goalMetToday ? '✓ Daily goal met' : `${stats.answeredToday} / ${progress.dailyGoal} today`}
              </Text>
              {retention && (
                <View style={styles.stepper}>
                  <PressableScale
                    onPress={() => setDailyGoal(progress.dailyGoal - 1)}
                    haptic="light"
                    style={styles.stepBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease daily goal"
                  >
                    <Ionicons name="remove" size={16} color={colors.gold} />
                  </PressableScale>
                  <Text style={styles.stepVal}>{progress.dailyGoal}</Text>
                  <PressableScale
                    onPress={() => setDailyGoal(progress.dailyGoal + 1)}
                    haptic="light"
                    style={styles.stepBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Increase daily goal"
                  >
                    <Ionicons name="add" size={16} color={colors.gold} />
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

        {/* Train CTAs */}
        <View style={styles.section}>
          <SectionTitle>TRAIN</SectionTitle>
          <TrainCard
            icon="flash"
            title="Spot Trainer"
            sub="A 10-spot quiz — score your reads"
            onPress={() => navigation.navigate('StudyTrainer', { mode: 'spot' })}
          />
          <TrainCard
            icon="repeat"
            title="Decision Trainer"
            sub="Continuous drilling — build instinct"
            onPress={() => navigation.navigate('StudyTrainer', { mode: 'decision' })}
          />
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

function TrainCard({ icon, title, sub, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string; onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} haptic="light">
      <Card style={styles.trainCard}>
        <View style={styles.trainIcon}>
          <Ionicons name={icon} size={22} color={colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.trainTitle}>{title}</Text>
          <Text style={styles.trainSub}>{sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 140, gap: spacing.lg },
  heroLabel: { ...typography.caps, color: colors.textMuted },
  streakRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  streakNum: { ...typography.amountHero, color: colors.gold },
  streakFlame: { fontSize: 30, marginBottom: spacing.sm },
  heroSub: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.xs },
  goalWrap: { marginTop: spacing.lg, gap: spacing.sm },
  goalTrack: { height: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.gold },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
});
