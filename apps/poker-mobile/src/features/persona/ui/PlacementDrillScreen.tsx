import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import StateView from '../../../components/StateView';
import EmptyState from '../../../components/EmptyState';
import PrimaryButton from '../../../components/PrimaryButton';
import ProgressBar from '../../../components/ProgressBar';
import PressableScale from '../../../components/motion/PressableScale';
import { MotiView, slideUpSequence, staggerIn } from '../../../components/motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useContent } from '../../../context/ContentContext';
import { track } from '../../../utils/analytics';
import { normalizeQuestions, selectQuestions, gradeAnswer, type QuizQuestion, type QuizChoice } from '../../study/logic/quiz';
import { localDayKey } from '../../study/logic/localDay';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { useStudy } from '../../study/state/StudyContext';
import { usePersona } from '../state/PersonaContext';
import {
  PLACEMENT_SIZE,
  placementQuestions,
  skillFromPlacement,
  placementLevelCopy,
} from '../logic/placement';
import { AccessibilityInfo } from 'react-native';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Phase = 'intro' | 'run' | 'result';

/**
 * Placement drill (slice 1.4) — five questions that calibrate the persona's skill level.
 *
 * ASSESSMENT, NOT PRACTICE: no answer is revealed and no explanation is shown during the run, so
 * the user gains a level and nothing else. That is precisely what makes it fair to leave it
 * OUT of the daily quiz / practice meters — it never touches StudyContext. It is also strictly
 * one-time (entry points check `persona.placement`), so it cannot be farmed for free questions.
 */
export default function PlacementDrillScreen() {
  const navigation = useNavigation<Nav>();
  const reduced = useReducedMotion();
  const { enabled, isLoaded, query } = useContent();
  const { isPremium } = useEntitlements();
  const { limitFor } = useStudy(); // READ-ONLY: the drill never consumes a meter, it only respects one
  const { recordPlacement } = usePersona();

  const [all, setAll] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  // Two presses in one tick read the same closure state — without this the final answer would
  // record the placement (and fire the event) twice. Same guard class as the funnel's name step.
  const finished = useRef(false);

  useEffect(() => {
    if (!isLoaded || !query) return;
    let cancelled = false;
    setError(false);
    setAll(null);
    query.all('quiz_bank')
      // FREE questions only — this is the one unmetered quiz surface, so a future premium pack
      // ingesting into `quiz_bank` must never leak through it.
      .then(rows => { if (!cancelled) setAll(selectQuestions(normalizeQuestions(rows), { freeOnly: !isPremium })); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isLoaded, query, isPremium, reloadKey]);

  const run = useMemo(
    () => (all ? placementQuestions(all, localDayKey()) : []),
    [all],
  );

  // Pre-bootstrap (ContentContext starts DISABLED while it ingests) counts as LOADING — otherwise
  // the first-run lead card would flash a dead-end "No questions yet" during the very first launch.
  const loading = !isLoaded || (enabled && !error && all === null);
  // The copy promises five questions, so a bank that can't fill a run shows the empty state
  // instead of silently scoring a short run against five-question bands.
  const canRun = run.length >= PLACEMENT_SIZE;
  const question = run[idx];

  function start() {
    track('placement_started');
    setPhase('run');
  }

  function answer(choice: QuizChoice) {
    if (finished.current) return;
    // No feedback, no explanation — the next question replaces this one immediately.
    const hit = gradeAnswer(question, choice).correct;
    const nextCorrect = correct + (hit ? 1 : 0);
    const nextIdx = idx + 1;
    setCorrect(nextCorrect);
    if (nextIdx >= run.length) {
      finished.current = true;
      const skill = skillFromPlacement(nextCorrect);
      void recordPlacement(nextCorrect, run.length);
      track('placement_completed', { score: nextCorrect, total: run.length, skill });
      setPhase('result');
      return;
    }
    setIdx(nextIdx);
  }

  // The run's ONLY feedback channel is content swapping — announce it, or the drill is silent
  // to VoiceOver/TalkBack users.
  useEffect(() => {
    if (phase === 'run' && question) {
      AccessibilityInfo.announceForAccessibility?.(
        `Question ${idx + 1} of ${run.length}. ${question.prompt}`,
      );
    } else if (phase === 'result') {
      AccessibilityInfo.announceForAccessibility?.(placementLevelCopy(skillFromPlacement(correct)).title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx]);

  const enter = (i: number) => slideUpSequence({ reduced, delay: staggerIn(i, 60), duration: 280 });
  const practiceLeft = limitFor('practiceQuestion').remaining;

  return (
    <Screen>
      <BrandHeader
        variant="screen"
        title="Find your level"
        subtitle="A quick calibration"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StateView
          loading={loading}
          error={error}
          isEmpty={!enabled || !canRun}
          empty={
            <EmptyState
              ionicon="help-circle-outline"
              title="No questions yet"
              subtitle="The question bank arrives with the next content update."
              action={{ label: 'Try the Spot Trainer', onPress: () => navigation.navigate('StudyTrainer', { mode: 'spot' }) }}
            />
          }
          onRetry={() => setReloadKey(k => k + 1)}
        >
          {phase === 'intro' && (
            <MotiView {...enter(0)} style={styles.block}>
              <Text style={styles.body}>
                {`Answer five quick questions and we'll set your starting level. No timer — take your time.`}
              </Text>
              <Card style={styles.noteCard}>
                <View style={styles.noteRow}>
                  <Ionicons name="eye-off-outline" size={16} color={colors.gold} />
                  <Text style={styles.noteText}>
                    {`We won't show the answers — this one only measures where to start you. It doesn't use any of your free daily questions, and it doesn't count toward your streak either. Pure calibration.`}
                  </Text>
                </View>
              </Card>
              <View style={styles.actions}>
                <PrimaryButton variant="gradient" label="Start" onPress={start} />
                <PressableScale
                  style={styles.quietBtn}
                  onPress={() => navigation.goBack()}
                  accessibilityRole="button"
                  accessibilityLabel="Not now"
                >
                  <Text style={styles.quietText}>Not now</Text>
                </PressableScale>
              </View>
            </MotiView>
          )}

          {phase === 'run' && !!question && (
            <MotiView key={question.id} {...enter(0)} style={styles.block}>
              <ProgressBar
                value={(idx + 1) / Math.max(run.length, 1)}
                height={6}
                accessibilityLabel={`Question ${idx + 1} of ${run.length}`}
              />
              <Text style={styles.progressText}>{`Question ${idx + 1} of ${run.length}`}</Text>
              <Card style={styles.questionCard}>
                <Text style={styles.questionText}>{question.prompt}</Text>
              </Card>
              <View style={styles.options}>
                {question.options.map((o, i) => (
                  <MotiView key={o.key} {...enter(i + 1)}>
                    <PressableScale
                      style={styles.option}
                      onPress={() => answer(o.key)}
                      haptic="light"
                      accessibilityRole="button"
                      accessibilityLabel={`Option ${o.key}: ${o.text}`}
                    >
                      <View style={styles.optionKey}>
                        <Text style={styles.optionKeyText}>{o.key}</Text>
                      </View>
                      <Text style={styles.optionText}>{o.text}</Text>
                    </PressableScale>
                  </MotiView>
                ))}
              </View>
            </MotiView>
          )}

          {phase === 'result' && (
            <MotiView {...enter(0)} style={styles.block}>
              <Text style={styles.kicker}>YOUR LEVEL</Text>
              <Text style={styles.headline} accessibilityRole="header">
                {placementLevelCopy(skillFromPlacement(correct)).title}
              </Text>
              {/* The score is a quiet caption, not a verdict headline. */}
              <Text style={styles.scoreCaption}>{`${correct} of ${run.length} correct`}</Text>
              <Text style={styles.body}>{placementLevelCopy(skillFromPlacement(correct)).body}</Text>
              <Card style={styles.noteCard}>
                <View style={styles.noteRow}>
                  <Ionicons name="speedometer-outline" size={16} color={colors.gold} />
                  <Text style={styles.noteText}>
                    {`A quick calibration, not a rating. You can change it anytime by retaking the setup quiz.`}
                  </Text>
                </View>
              </Card>
              <View style={styles.actions}>
                {/* Never send the user into a spent pool — the drill CTA yields to Done. */}
                {practiceLeft > 0 ? (
                  <>
                    <PrimaryButton
                      variant="gradient"
                      label="Start the Spot Trainer"
                      onPress={() => navigation.navigate('StudyTrainer', { mode: 'spot' })}
                    />
                    <PressableScale
                      style={styles.quietBtn}
                      onPress={() => navigation.goBack()}
                      accessibilityRole="button"
                      accessibilityLabel="Done"
                    >
                      <Text style={styles.quietText}>Done</Text>
                    </PressableScale>
                  </>
                ) : (
                  <PrimaryButton variant="gradient" label="Done" onPress={() => navigation.goBack()} />
                )}
              </View>
            </MotiView>
          )}
        </StateView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 60, gap: spacing.md },
  block: { gap: spacing.md, width: '100%', maxWidth: 480, alignSelf: 'center' },
  kicker: { ...typography.caps, color: colors.gold },
  scoreCaption: { ...typography.bodySmall, color: colors.textMuted },
  headline: { ...typography.displaySerif, fontSize: 26, lineHeight: 34, color: colors.text },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 24 },
  noteCard: { paddingVertical: spacing.md },
  noteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  noteText: { ...typography.bodySmall, color: colors.textMuted, flex: 1, lineHeight: 20 },
  actions: { marginTop: spacing.md, gap: spacing.sm },
  quietBtn: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingVertical: spacing.sm },
  quietText: { ...typography.label, color: colors.textMuted },
  progressText: { ...typography.bodySmall, color: colors.textMuted },
  questionCard: { paddingVertical: spacing.lg },
  questionText: { ...typography.h4, color: colors.text, lineHeight: 26 },
  options: { gap: spacing.md },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 64,
  },
  optionKey: {
    width: 28, height: 28, borderRadius: radii.sm, backgroundColor: colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  optionKeyText: { ...typography.label, color: colors.textMuted },
  optionText: { ...typography.body, color: colors.textHigh, flex: 1 },
});
