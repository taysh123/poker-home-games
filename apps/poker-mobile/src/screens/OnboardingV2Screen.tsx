import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Platform, TextInput, KeyboardAvoidingView, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import PressableScale from '../components/motion/PressableScale';
import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as storage from '../utils/storage';
import { track, markSignupIntent } from '../utils/analytics';
import { showToast } from '../utils/toast';
import { isFeatureEnabled } from '../config/features';
import { usePersona } from '../features/persona/state/PersonaContext';
import {
  FUNNEL_STEPS,
  nextStep,
  prevStep,
  GOAL_OPTIONS,
  SKILL_OPTIONS,
  FORMAT_OPTIONS,
  orderActionsForGoal,
  type QuizStep,
  type FunnelOption,
} from '../features/persona/logic/funnel';
import type { PersonaGoal } from '../features/persona/types';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding' | 'PersonaQuiz'>;
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type ActionKey = 'play' | 'track' | 'study' | 'improve' | 'placement';

/** Copy per question step — headlines are chapters (DM Serif), subs stay quiet. */
// Copy is PURPOSE-TRUE for what ships today (critique 2026-07-22): goal drives the router order
// now; skill/format personalization arrives in slice 1.3 — the subs promise nothing until it does.
const STEP_COPY: Record<Exclude<QuizStep, 'promise' | 'name'>, { headline: string; sub: string }> = {
  goal: { headline: 'What brings you to the table?', sub: 'We tune your first screen around this.' },
  skill: { headline: 'How sharp is your game?', sub: 'No wrong answers.' },
  format: { headline: 'What do you play?', sub: 'Cash and tournaments play differently.' },
};

const STEP_OPTIONS: Record<Exclude<QuizStep, 'promise' | 'name'>, FunnelOption[]> = {
  goal: GOAL_OPTIONS,
  skill: SKILL_OPTIONS,
  format: FORMAT_OPTIONS,
};

/** The beat between selecting and advancing — long enough to feel the choice land. */
const SELECT_BEAT_MS = 250;

/**
 * Quiet Luxury funnel (Wave 1) — the personalized onboarding quiz. Replaces the pillar slides
 * (their promise lives in step one); `onboardingV2` OFF still falls back to the legacy screen.
 * One question per screen, one tap per answer, skippable ALWAYS; every answer commits to the
 * persona store immediately (skip keeps partials). Exit contract everywhere: await markSeen()
 * THEN navigation.reset. The typed name is display-only — NEVER in analytics (test-pinned).
 */
export default function OnboardingV2Screen({ navigation, route }: Props) {
  const reduced = useReducedMotion();
  const { persona, isLoaded: personaLoaded, answerStep, completeFunnel } = usePersona();
  // Retake mode (1.3): the same funnel mounted at the PersonaQuiz route — a calm REVIEW, not a
  // replay of first-run: it opens on the first QUESTION (no promise marketing), answers pre-seed
  // from the stored persona, there is NO router at the end, and every exit goBack()s to wherever
  // the user launched it (never a stack reset, never a markSeen write).
  const retake = route.name === 'PersonaQuiz';

  const [phase, setPhase] = useState<'quiz' | 'router'>('quiz');
  const [step, setStep] = useState<QuizStep>(retake ? 'goal' : 'promise');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(() => (retake ? persona?.displayName ?? '' : ''));
  // Local mirror of this run's answers — synchronous source for analytics + router ordering.
  const [answers, setAnswers] = useState<{ goal?: string; skill?: string; format?: string }>(() =>
    retake && persona
      ? {
          ...(persona.goal ? { goal: persona.goal } : {}),
          ...(persona.skill ? { skill: persona.skill } : {}),
          ...(persona.format ? { format: persona.format } : {}),
        }
      : {},
  );
  const beatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameSubmitted = useRef(false); // double-tap guard — one completion, one event
  const retakeSeeded = useRef(false);
  // Every funnel event carries the retake tag (ids/flags only — first-run funnels stay clean).
  const evRetake = retake ? { retake: true } : {};

  // Retake pre-seed can race the store load on a cold mount (lazy useState saw persona=null):
  // re-seed ONCE when the persona arrives, unless the user already started answering.
  useEffect(() => {
    if (!retake || !personaLoaded || retakeSeeded.current || !persona) return;
    retakeSeeded.current = true;
    setAnswers(prev =>
      Object.keys(prev).length > 0
        ? prev
        : {
            ...(persona.goal ? { goal: persona.goal } : {}),
            ...(persona.skill ? { skill: persona.skill } : {}),
            ...(persona.format ? { format: persona.format } : {}),
          },
    );
    setName(prev => (prev.length > 0 ? prev : persona.displayName ?? ''));
  }, [retake, personaLoaded, persona]);

  useEffect(() => {
    if (retake) track('onboarding_started', { retake: true });
    else track('onboarding_started');
    return () => { if (beatTimer.current) clearTimeout(beatTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Announce each step's headline so the 250ms content swap isn't silent to screen readers.
  useEffect(() => {
    const headline =
      phase === 'router' ? 'Where do you want to start?' :
      step === 'promise' ? 'Win your home game.' :
      step === 'name' ? 'What should we call you?' :
      STEP_COPY[step].headline;
    AccessibilityInfo.announceForAccessibility?.(headline);
  }, [phase, step]);

  async function markSeen() {
    try { await storage.setItemAsync('hasSeenOnboarding', 'true'); } catch { /* best-effort */ }
  }

  function advanceFrom(current: QuizStep) {
    setSelectedId(null);
    const next = nextStep(current);
    if (next === 'router') setPhase('router');
    else setStep(next);
  }

  function chooseOption(current: Exclude<QuizStep, 'promise' | 'name'>, id: string) {
    if (selectedId) return; // the beat is running — one choice per step
    setSelectedId(id);
    setAnswers(prev => ({ ...prev, [current]: id }));
    void answerStep(current, id);
    track('funnel_step_answered', { step: current, answer: id, ...evRetake });
    if (reduced) { advanceFrom(current); return; }
    beatTimer.current = setTimeout(() => advanceFrom(current), SELECT_BEAT_MS);
  }

  function goBack() {
    if (beatTimer.current) { clearTimeout(beatTimer.current); beatTimer.current = null; }
    setSelectedId(null);
    const prev = prevStep(step);
    if (prev) setStep(prev);
  }

  async function finishName(named: boolean) {
    if (nameSubmitted.current) return;
    nameSubmitted.current = true;
    const trimmed = named ? name.trim() : '';
    // Retake + "Skip this" = leave-unchanged: NEVER a destructive write over an existing name.
    // (Deliberately clearing the field and pressing Continue still clears it.)
    if (!retake || named) void answerStep('name', trimmed);
    void completeFunnel();
    const namedFlag = retake && !named ? !!persona?.displayName : trimmed.length > 0;
    // IDs + flags only — the typed name itself never leaves the device via analytics.
    track('funnel_completed', {
      goal: answers.goal ?? null,
      skill: answers.skill ?? null,
      format: answers.format ?? null,
      named: namedFlag,
      ...evRetake,
    });
    if (retake) {
      showToast('Setup updated.', 'success');
      navigation.goBack();
      return;
    }
    setPhase('router');
  }

  async function skip() {
    track('onboarding_skipped', { from: phase, ...evRetake });
    if (retake) { navigation.goBack(); return; } // review cancelled — no reset, no markSeen
    await markSeen();
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  }

  // Router's quiet exit is a COMPLETION, not a skip — the user finished the quiz and simply
  // declined a starting action (critique: skip() here undercounted completion metrics).
  async function exploreOnOwn() {
    track('onboarding_completed', { via: 'explore' });
    await markSeen();
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  }

  async function enterAction(action: ActionKey, target: keyof RootStackParamList, params?: object) {
    track('onboarding_completed', { via: action });
    track('first_action_completed', { action });
    await markSeen();
    navigation.reset({
      index: 1,
      routes: [{ name: 'MainTabs' }, { name: target as any, params: params as any }],
    });
  }

  async function chooseImprove() {
    track('onboarding_completed', { via: 'improve' });
    await markSignupIntent();
    await markSeen();
    navigation.reset({ index: 1, routes: [{ name: 'MainTabs' }, { name: 'Login' }] });
  }

  const actions: { key: ActionKey; icon: IoniconsName; title: string; sub: string; onPress: () => void; show: boolean; teaser?: boolean }[] = [
    {
      key: 'play', icon: 'play', title: 'Start a game', sub: 'Deal in your crew right now',
      onPress: () => enterAction('play', 'LocalNewGame', { mode: 'cash' }), show: true,
    },
    {
      key: 'track', icon: 'wallet-outline', title: 'Log a session', sub: 'Add a game you already played',
      onPress: () => enterAction('track', 'LogSession'), show: isFeatureEnabled('bankroll'),
    },
    {
      key: 'study', icon: 'school-outline', title: 'Drill a spot', sub: 'Quick preflop reps',
      onPress: () => enterAction('study', 'StudyTrainer', { mode: 'spot' }), show: isFeatureEnabled('study'),
    },
    {
      // Expectation-true copy (critique): the tap leads to sign-in for first access, not a trial.
      key: 'improve', icon: 'sparkles', title: 'AI Coach', sub: 'Hand coaching — coming soon. Get first access.',
      onPress: chooseImprove, show: isFeatureEnabled('coach'), teaser: true,
    },
  ];

  const goalForOrder = (answers.goal ?? persona?.goal ?? null) as PersonaGoal | null;
  const orderedActions = orderActionsForGoal(actions.filter(a => a.show), goalForOrder);
  // 1.4 — the placement drill LEADS the router the first time (one-time; hidden once taken).
  const showPlacement = isFeatureEnabled('study') && !persona?.placement;
  const routerActions = showPlacement
    ? [
        {
          key: 'placement' as ActionKey,
          icon: 'speedometer-outline' as IoniconsName,
          title: 'Find your level',
          sub: "5 questions — we'll set your starting point",
          onPress: () => enterAction('placement', 'PlacementDrill'),
          show: true,
        },
        ...orderedActions,
      ]
    : orderedActions;

  // Progress: first-run = quiz steps + the router (6 units, never starts at zero); retake = the
  // four question steps only (no promise, no router).
  const totalUnits = retake ? FUNNEL_STEPS.length - 1 : FUNNEL_STEPS.length + 1;
  const stepIndex = retake
    ? FUNNEL_STEPS.indexOf(step) - 1
    : phase === 'router' ? FUNNEL_STEPS.length : FUNNEL_STEPS.indexOf(step);
  const progressPct = ((stepIndex + 1) / totalUnits) * 100;

  const enter = (i: number) => slideUpSequence({ reduced, delay: staggerIn(i, 60), duration: 280 });

  return (
    <Screen style={styles.container}>
      {/* Quiet progress — always present, never at zero; a real progressbar to screen readers */}
      <View
        style={styles.progressTrack}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${stepIndex + 1} of ${totalUnits}`}
        accessibilityValue={{ min: 0, max: totalUnits, now: stepIndex + 1 }}
      >
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      {/* Skip — every phase, always quiet */}
      <PressableScale
        style={styles.skipBtn}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel="Skip onboarding"
      >
        <Text style={styles.skipText}>Skip</Text>
      </PressableScale>

      {phase === 'quiz' && step === 'promise' && (
        <MotiView key="promise" {...enter(0)} style={styles.promiseWrap}>
          <View style={styles.brandRow}>
            <View style={styles.brandLogoRing}>
              <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
            </View>
          </View>
          <Text style={styles.promiseHeadline} accessibilityRole="header">Win your home game.</Text>
          <Text style={styles.promiseSub}>Study daily. Run the night. Know your numbers.</Text>
          <View style={styles.promiseCtaWrap}>
            <PrimaryButton
              variant="gradient"
              label="Let's set you up"
              onPress={() => advanceFrom('promise')}
            />
            <Text style={styles.promiseFootnote}>A few quick questions — under a minute.</Text>
          </View>
        </MotiView>
      )}

      {phase === 'quiz' && step !== 'promise' && step !== 'name' && (
        <MotiView key={step} {...enter(0)} style={styles.stepWrap}>
          <Text style={styles.stepHeadline} accessibilityRole="header">{STEP_COPY[step].headline}</Text>
          <Text style={styles.stepSub}>{STEP_COPY[step].sub}</Text>
          <View style={styles.options}>
            {STEP_OPTIONS[step].map((o, i) => {
              // Selection survives Back: the ephemeral beat selection OR the recorded answer.
              const selected = selectedId === o.id || (!selectedId && answers[step] === o.id);
              return (
                <MotiView key={o.id} {...enter(i + 1)}>
                  <PressableScale
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => chooseOption(step, o.id)}
                    haptic="light"
                    accessibilityRole="button"
                    accessibilityLabel={`${o.label}. ${o.sub ?? ''}`}
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{o.label}</Text>
                      {!!o.sub && <Text style={styles.optionSub}>{o.sub}</Text>}
                    </View>
                    {/* Non-color selection affordance (never color alone) */}
                    {selected && <Ionicons name="checkmark-circle" size={20} color={colors.gold} />}
                  </PressableScale>
                </MotiView>
              );
            })}
          </View>
        </MotiView>
      )}

      {phase === 'quiz' && step === 'name' && (
        <KeyboardAvoidingView
          style={styles.kavWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <MotiView key="name" {...enter(0)} style={styles.stepWrap}>
          <Text style={styles.stepHeadline} accessibilityRole="header">What should we call you?</Text>
          <Text style={styles.stepSub}>Optional — stays on this device.</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="Your name (optional)"
            placeholderTextColor={colors.textDim}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void finishName(true)}
            accessibilityLabel="Your name, optional"
          />
          <View style={styles.nameActions}>
            <PrimaryButton label="Continue" onPress={() => void finishName(true)} />
            <PressableScale
              style={styles.quietBtn}
              onPress={() => void finishName(false)}
              accessibilityRole="button"
              accessibilityLabel="Skip the name question"
            >
              <Text style={styles.quietBtnText}>Skip this</Text>
            </PressableScale>
          </View>
        </MotiView>
        </KeyboardAvoidingView>
      )}

      {phase === 'router' && (
        <MotiView key="router" {...enter(0)} style={styles.routerWrap}>
          <View style={styles.routerHead}>
            <Text style={styles.routerTitle} accessibilityRole="header">Where do you want to start?</Text>
            <Text style={styles.routerSub}>Jump in — no account needed.</Text>
          </View>

          <View style={styles.cards}>
            {routerActions.map((a, i) => (
              <MotiView key={a.key} {...enter(i + 1)}>
                <PressableScale
                  style={[styles.card, a.teaser && styles.cardTeaser]}
                  onPress={a.onPress}
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityLabel={`${a.title}. ${a.sub}`}
                >
                  <View style={[styles.cardIcon, a.teaser && styles.cardIconTeaser]}>
                    <Ionicons name={a.icon} size={20} color={a.teaser ? colors.background : colors.gold} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{a.title}</Text>
                    <Text style={styles.cardSub}>{a.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </PressableScale>
              </MotiView>
            ))}
          </View>

          <PressableScale
            style={styles.quietBtn}
            onPress={exploreOnOwn}
            accessibilityRole="button"
            accessibilityLabel="Explore on my own"
          >
            <Text style={styles.quietBtnText}>I'll explore on my own</Text>
          </PressableScale>
        </MotiView>
      )}

      {/* Back — quiz question steps only (nothing behind the promise, or behind retake's first question) */}
      {phase === 'quiz' && step !== 'promise' && !(retake && step === 'goal') && (
        <PressableScale
          style={styles.backBtn}
          onPress={goBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>Back</Text>
        </PressableScale>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    paddingHorizontal: spacing.xl,
  },

  progressTrack: {
    height: 3, borderRadius: 2, backgroundColor: colors.surfaceHigh,
    marginTop: spacing.sm, marginBottom: spacing.md, marginRight: 72, // clear of the floating Skip
    overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: colors.gold },
  kavWrap: { flex: 1 },

  skipBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 36, right: 24, zIndex: 10, paddingHorizontal: 12, paddingVertical: 6, minHeight: 44, justifyContent: 'center' },
  skipText: { ...typography.bodySmall, color: colors.textMuted, fontWeight: '600' },

  // Promise (maxWidth keeps web/desktop composed — cards never stretch full-bleed)
  promiseWrap: { flex: 1, justifyContent: 'center', gap: spacing.md, width: '100%', maxWidth: 480, alignSelf: 'center' },
  brandRow: { alignItems: 'center', marginBottom: spacing.lg },
  brandLogoRing: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.goldMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  brandLogo: { width: 52, height: 52 },
  promiseHeadline: { ...typography.displaySerif, fontSize: 34, lineHeight: 42, color: colors.text, textAlign: 'center' },
  promiseSub: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },
  promiseCtaWrap: { marginTop: spacing.xl, gap: spacing.md, alignItems: 'center' },
  // textMuted, not textDim: this is informational copy, not a placeholder (WCAG AA on background).
  promiseFootnote: { ...typography.caption, color: colors.textMuted },

  // Question steps
  stepWrap: { flex: 1, justifyContent: 'center', gap: spacing.sm, width: '100%', maxWidth: 480, alignSelf: 'center' },
  stepHeadline: { ...typography.displaySerif, fontSize: 26, lineHeight: 34, color: colors.text },
  stepSub: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.lg },
  options: { gap: spacing.md },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 64,
  },
  optionSelected: { borderColor: colors.gold, backgroundColor: colors.goldFaint },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { ...typography.label, color: colors.text },
  optionLabelSelected: { color: colors.goldLight },
  optionSub: { ...typography.bodySmall, color: colors.textMuted },

  // Name step
  nameInput: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.control, paddingHorizontal: spacing.lg, paddingVertical: 14, minHeight: 52,
    ...typography.body, color: colors.text,
  },
  nameActions: { marginTop: spacing.lg, gap: spacing.sm },

  // Router
  routerWrap: { flex: 1, justifyContent: 'center', gap: spacing.xl, width: '100%', maxWidth: 480, alignSelf: 'center' },
  routerHead: { gap: spacing.xs, alignItems: 'center' },
  routerTitle: { ...typography.h1, color: colors.text, textAlign: 'center' },
  routerSub: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  cards: { gap: spacing.md },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 44,
  },
  cardTeaser: { borderColor: colors.goldMuted, backgroundColor: colors.goldFaint },
  cardIcon: {
    width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.goldFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  cardIconTeaser: { backgroundColor: colors.gold },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...typography.label, color: colors.text },
  cardSub: { ...typography.bodySmall, color: colors.textMuted },

  quietBtn: { alignItems: 'center', paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  quietBtnText: { ...typography.label, color: colors.textMuted },

  backBtn: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 52 : 36, left: 24,
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 8,
  },
  backText: { ...typography.bodySmall, color: colors.textMuted, fontWeight: '600' },
});
