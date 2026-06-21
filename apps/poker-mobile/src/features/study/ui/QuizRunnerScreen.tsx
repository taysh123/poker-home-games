/**
 * Quiz Runner (PR #5) — runs a multiple-choice quiz sourced from the ContentStore (read-only, via
 * useContent().query; never the workbook). Flag-gated (`content`); honest empty state until quiz packs
 * are bundled. Phases: pick (category + count) → run (question, select, grade, feedback) → results.
 *
 * Pure logic (normalize / grade / select / score) lives in ../logic/quiz.ts and is unit-tested; this
 * screen is presentation + flow only. Grading is read-only — no writes, no mastery side effects yet.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import StateView from '../../../components/StateView';
import Chip from '../../../components/Chip';
import PrimaryButton from '../../../components/PrimaryButton';
import PressableScale from '../../../components/motion/PressableScale';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useContent } from '../../../context/ContentContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useMastery } from '../../mastery/state/MasteryContext';
import type { ObjectiveMastery } from '../../mastery/types';
import {
  normalizeQuestions,
  selectQuestions,
  gradeAnswer,
  scoreQuiz,
  categoriesOf,
  runBreakdown,
  type QuizQuestion,
  type QuizChoice,
} from '../logic/quiz';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'QuizRunner'>;

const RUN_LIMIT = 10; // questions per run

/** Objective key for mastery: the LearningObjectiveID when present, else a labeled category proxy.
 *  (The bundled quiz sample lacks LearningObjectiveID — the `cat:` proxy is honest + clearly category-level.) */
function objectiveKeyOf(q: QuizQuestion): string {
  if (q.learningObjectiveId) return q.learningObjectiveId;
  return q.category ? `cat:${q.category}` : '';
}

/** Human label for an objective key (strip the category-proxy prefix). */
function objectiveLabel(key: string): string {
  return key.startsWith('cat:') ? key.slice(4) : key;
}

type Phase = 'pick' | 'run' | 'results';

export default function QuizRunnerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { enabled, isLoaded, query } = useContent();
  const mastery = useMastery();

  const [all, setAll] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Flow state
  const [phase, setPhase] = useState<Phase>('pick');
  const [category, setCategory] = useState<string | null>(null);
  const [run, setRun] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<QuizChoice | null>(null);
  const [outcomes, setOutcomes] = useState<boolean[]>([]);

  useEffect(() => {
    if (!isLoaded || !query) return;
    let cancelled = false;
    setError(false);
    setAll(null);
    query.all('quiz_bank')
      .then(rows => {
        if (cancelled) return;
        let qs = normalizeQuestions(rows);
        if (route.params?.collectionId) qs = qs.filter(q => q.collectionId === route.params!.collectionId);
        setAll(qs);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isLoaded, query, route.params?.collectionId, reloadKey]);

  const categories = useMemo(() => (all ? categoriesOf(all) : []), [all]);
  const loading = enabled && !error && (!isLoaded || all === null);

  const startRun = (cat: string | null) => {
    const pool = selectQuestions(all ?? [], { category: cat ?? undefined, limit: RUN_LIMIT });
    if (pool.length === 0) return;
    setCategory(cat);
    setRun(pool);
    setIdx(0);
    setChosen(null);
    setOutcomes([]);
    setPhase('run');
  };

  const answer = (choice: QuizChoice) => {
    if (chosen) return; // lock after first selection
    setChosen(choice);
    const correct = gradeAnswer(run[idx], choice).correct;
    setOutcomes(prev => [...prev, correct]);
    mastery.record(objectiveKeyOf(run[idx]), correct); // no-op when the mastery flag is OFF
  };

  const next = () => {
    if (idx + 1 >= run.length) { setPhase('results'); return; }
    setIdx(idx + 1);
    setChosen(null);
  };

  const restart = () => { setPhase('pick'); setCategory(null); setRun([]); setIdx(0); setChosen(null); setOutcomes([]); };

  return (
    <Screen animated>
      <BrandHeader variant="screen" title="Quiz" subtitle={subtitleFor(phase, category)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StateView
          loading={loading}
          error={error}
          isEmpty={!enabled || !all || all.length === 0}
          empty={<EmptyState ionicon="help-circle-outline" title="No quizzes yet" subtitle="Quizzes arrive with the next content update." />}
          onRetry={() => setReloadKey(k => k + 1)}
        >
          {phase === 'pick' ? (
            <PickView
              total={all?.length ?? 0}
              categories={categories}
              onStartAll={() => startRun(null)}
              onStartCategory={(c) => startRun(c)}
            />
          ) : phase === 'run' ? (
            <RunView
              question={run[idx]}
              index={idx}
              count={run.length}
              chosen={chosen}
              onAnswer={answer}
              onNext={next}
              isLast={idx + 1 >= run.length}
            />
          ) : (
            <ResultsView
              run={run}
              outcomes={outcomes}
              masteryEnabled={mastery.enabled}
              masteryFor={mastery.masteryFor}
              onRestart={restart}
              onDone={() => navigation.goBack()}
            />
          )}
        </StateView>
      </ScrollView>
    </Screen>
  );
}

function subtitleFor(phase: Phase, category: string | null): string {
  if (phase === 'pick') return 'Test your reads';
  if (phase === 'results') return 'Your score';
  return category ?? 'All categories';
}

function PickView({ total, categories, onStartAll, onStartCategory }: {
  total: number; categories: string[]; onStartAll: () => void; onStartCategory: (c: string) => void;
}) {
  return (
    <>
      <Card variant="hero">
        <Text style={styles.heroLabel}>QUESTION BANK</Text>
        <Text style={styles.heroNum}>{total}</Text>
        <Text style={styles.heroSub}>Up to {RUN_LIMIT} questions per run · educational, not solver output</Text>
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label="Start quiz" variant="gradient" onPress={onStartAll} />
        </View>
      </Card>

      {categories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BY CATEGORY</Text>
          {categories.map(c => (
            <PressableScale key={c} haptic="light" accessibilityRole="button" accessibilityLabel={`Start ${c} quiz`} onPress={() => onStartCategory(c)}>
              <Card style={styles.row}>
                <View style={styles.icon}><Ionicons name="albums-outline" size={20} color={colors.gold} /></View>
                <Text style={styles.rowName}>{c}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Card>
            </PressableScale>
          ))}
        </View>
      )}
    </>
  );
}

function RunView({ question, index, count, chosen, onAnswer, onNext, isLast }: {
  question: QuizQuestion; index: number; count: number; chosen: QuizChoice | null;
  onAnswer: (c: QuizChoice) => void; onNext: () => void; isLast: boolean;
}) {
  const answered = chosen !== null;
  return (
    <>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(((index + 1) / Math.max(count, 1)) * 100)}%` }]} />
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>Question {index + 1} of {count}</Text>
        {!!question.difficulty && <Chip label={question.difficulty} tone="gold" />}
      </View>

      <Card style={styles.questionCard}>
        <Text style={styles.questionText}>{question.prompt}</Text>
      </Card>

      <View style={styles.options}>
        {question.options.map(opt => {
          const state = optionState(opt.key, question.correct, chosen);
          return (
            <PressableScale
              key={opt.key}
              haptic="light"
              disabled={answered}
              accessibilityRole="button"
              accessibilityLabel={`Option ${opt.key}: ${opt.text}`}
              onPress={() => onAnswer(opt.key)}
            >
              <View style={[styles.option, optionStyle(state)]}>
                <View style={[styles.optionKey, optionKeyStyle(state)]}>
                  {state === 'correct' ? (
                    <Ionicons name="checkmark" size={16} color={colors.background} />
                  ) : state === 'wrong' ? (
                    <Ionicons name="close" size={16} color={colors.background} />
                  ) : (
                    <Text style={styles.optionKeyText}>{opt.key}</Text>
                  )}
                </View>
                <Text style={[styles.optionText, state !== 'idle' && styles.optionTextActive]}>{opt.text}</Text>
              </View>
            </PressableScale>
          );
        })}
      </View>

      {answered && (
        <Feedback
          correct={chosen === question.correct}
          correctKey={question.correct}
          explanation={question.explanation}
        />
      )}

      {answered && (
        <View style={{ marginTop: spacing.md }}>
          <PrimaryButton label={isLast ? 'See results' : 'Next question'} onPress={onNext} />
        </View>
      )}
    </>
  );
}

/** Answer feedback with a subtle entrance (fade + rise). Respects reduced motion (renders instantly). */
function Feedback({ correct, correctKey, explanation }: { correct: boolean; correctKey: QuizChoice; explanation: string }) {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { anim.setValue(1); return; }
    Animated.timing(anim, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [reduced, anim]);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      <Card style={styles.feedback}>
        <View style={styles.feedbackHead}>
          <Ionicons name={correct ? 'checkmark-circle' : 'close-circle'} size={18} color={correct ? colors.success : colors.error} />
          <Text style={styles.feedbackTitle}>{correct ? 'Correct' : `Correct answer: ${correctKey}`}</Text>
        </View>
        {!!explanation && <Text style={styles.feedbackBody}>{explanation}</Text>}
      </Card>
    </Animated.View>
  );
}

function ResultsView({ run, outcomes, masteryEnabled, masteryFor, onRestart, onDone }: {
  run: QuizQuestion[]; outcomes: boolean[];
  masteryEnabled: boolean; masteryFor: (key: string) => ObjectiveMastery | null;
  onRestart: () => void; onDone: () => void;
}) {
  const score = scoreQuiz(outcomes);
  const breakdown = runBreakdown(run, outcomes);
  // Honest mastery readout — ONLY from real recorded attempts (mastery flag on); distinct keys touched this run.
  const masteryRows = masteryEnabled
    ? Array.from(new Set(run.map(objectiveKeyOf).filter(Boolean)))
        .map(key => ({ key, state: masteryFor(key) }))
        .filter((r): r is { key: string; state: ObjectiveMastery } => r.state !== null)
    : [];
  return (
    <>
      <Card variant="hero">
        <Text style={styles.heroLabel}>YOUR SCORE</Text>
        <Text style={styles.heroNum}>{score.pct}%</Text>
        <Text style={styles.heroSub}>{score.correct} of {score.total} correct</Text>
      </Card>

      {breakdown.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>THIS RUN BY CATEGORY</Text>
          {breakdown.map(b => (
            <View key={b.category} style={styles.breakdownRow}>
              <Text style={styles.breakdownCat} numberOfLines={1}>{b.category}</Text>
              <Text style={styles.breakdownVal}>{b.correct}/{b.total}</Text>
            </View>
          ))}
        </View>
      )}

      {masteryRows.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR MASTERY · BASED ON YOUR ATTEMPTS SO FAR</Text>
          {masteryRows.map(r => (
            <View key={r.key} style={styles.breakdownRow}>
              <Text style={styles.breakdownCat} numberOfLines={1}>{objectiveLabel(r.key)}</Text>
              <Chip label={r.state} tone={r.state === 'Mastered' ? 'gold' : r.state === 'Proficient' ? 'success' : 'neutral'} solid={r.state === 'Mastered'} />
            </View>
          ))}
        </View>
      )}

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <PrimaryButton label="Try another" variant="gradient" onPress={onRestart} />
        <PrimaryButton label="Done" variant="outline" onPress={onDone} />
      </View>
    </>
  );
}

type OptState = 'idle' | 'correct' | 'wrong' | 'dim';
function optionState(key: QuizChoice, correct: QuizChoice, chosen: QuizChoice | null): OptState {
  if (chosen === null) return 'idle';
  if (key === correct) return 'correct';
  if (key === chosen) return 'wrong';
  return 'dim';
}
function optionStyle(s: OptState) {
  if (s === 'correct') return { borderColor: colors.success, backgroundColor: 'rgba(39,174,96,0.10)' };
  if (s === 'wrong') return { borderColor: colors.error, backgroundColor: colors.errorFaint };
  if (s === 'dim') return { opacity: 0.5 };
  return null;
}
function optionKeyStyle(s: OptState) {
  if (s === 'correct') return { backgroundColor: colors.success };
  if (s === 'wrong') return { backgroundColor: colors.error };
  return null;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 140, gap: spacing.md },
  heroLabel: { ...typography.caps, color: colors.textMuted },
  heroNum: { ...typography.amountHero, lineHeight: 52, color: colors.gold, marginTop: spacing.xs },
  heroSub: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.xs },
  section: { gap: spacing.sm },
  sectionLabel: { ...typography.caps, color: colors.textMuted, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center' },
  rowName: { ...typography.h4, color: colors.text, flex: 1 },
  progressTrack: { height: 6, borderRadius: radii.pill, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.gold },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressText: { ...typography.bodySmall, color: colors.textMuted },
  questionCard: { paddingVertical: spacing.lg },
  questionText: { ...typography.h4, color: colors.text, lineHeight: 26 },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    backgroundColor: colors.surface, paddingVertical: spacing.md, paddingHorizontal: spacing.md,
  },
  optionKey: {
    width: 30, height: 30, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  optionKeyText: { ...typography.label, color: colors.textHigh },
  optionText: { ...typography.body, color: colors.textHigh, flex: 1 },
  optionTextActive: { color: colors.text },
  feedback: { marginTop: spacing.sm, gap: spacing.xs },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feedbackTitle: { ...typography.h4, color: colors.text },
  feedbackBody: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  breakdownCat: { ...typography.body, color: colors.textHigh, flex: 1 },
  breakdownVal: { ...typography.label, color: colors.gold },
});
