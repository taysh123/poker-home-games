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
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useStudy } from '../state/StudyContext';
import { studyStats } from '../logic/progress';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const todayKey = () => new Date().toISOString().slice(0, 10);

export default function StudyScreen() {
  const navigation = useNavigation<Nav>();
  const { progress, dataset } = useStudy();
  const stats = studyStats(progress, todayKey());
  const goalPct = Math.min(1, progress.dailyGoal > 0 ? stats.answeredToday / progress.dailyGoal : 0);

  return (
    <Screen animated>
      <BrandHeader variant="brand" title="Study" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Streak hero */}
        <Card variant="hero">
          <Text style={styles.heroLabel}>CURRENT STREAK</Text>
          <View style={styles.streakRow}>
            <Text style={styles.streakNum}>{progress.currentStreak}</Text>
            <Text style={styles.streakFlame}>🔥</Text>
          </View>
          <Text style={styles.heroSub}>
            {progress.currentStreak === 0
              ? 'Train a spot today to start a streak'
              : `day${progress.currentStreak === 1 ? '' : 's'} in a row · best ${progress.longestStreak}`}
          </Text>

          {/* Daily goal */}
          <View style={styles.goalWrap}>
            <View style={styles.goalTrack}>
              <View style={[styles.goalFill, { width: `${goalPct * 100}%` }]} />
            </View>
            <Text style={styles.goalText}>
              {stats.goalMetToday ? '✓ Daily goal met' : `${stats.answeredToday} / ${progress.dailyGoal} today`}
            </Text>
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
  goalText: { ...typography.bodySmall, color: colors.textMuted },
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
