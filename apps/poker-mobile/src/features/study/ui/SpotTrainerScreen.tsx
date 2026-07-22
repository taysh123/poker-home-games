import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import ProgressBar from '../../../components/ProgressBar';
import PressableScale from '../../../components/motion/PressableScale';
import AnimatedNumber from '../../../components/motion/AnimatedNumber';
import Celebration from '../../../components/motion/Celebration';
import { MotiView, successPop } from '../../../components/motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { iconSize } from '../../../theme/iconSize';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import CrossPillarCTA from '../../../components/CrossPillarCTA';
import { isFeatureEnabled } from '../../../config/features';
import { useStudy } from '../state/StudyContext';
import { track } from '../../../utils/analytics';
import { requestReminderPermissionOnce } from '../../../utils/reminders';
import { useEntitlements } from '../../../context/EntitlementsContext';
import LockNudge from './LockNudge';
import Chip from '../../../components/Chip';
import { generateSpot, evaluateSpot, type Spot, type SpotResult } from '../logic/trainer';
import { practiceRunCap } from '../logic/dailyLimits';
import type { RangeAction } from '../types';
import TableScene from '../../../components/table/TableScene';
import ActionTimeline from '../../../components/table/ActionTimeline';
import type { SeatProps } from '../../../components/table/TableSeat';
import ContentContainer from '../../../components/ContentContainer';
import { tableDimensions } from '../../../utils/tableLayout';
import { HoleCards } from '../../../components/table/PlayingCard';
import { buildTrainerHand } from '../../../utils/trainerHand';
import type { PokerPosition, PlayerAction } from '../../../utils/pokerTable';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'StudyTrainer'>;

const QUIZ_LENGTH = 10;
const ACTION_LABEL: Record<RangeAction, string> = { fold: 'Fold', call: 'Call', raise: 'Raise' };

export default function SpotTrainerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const insets = useSafeAreaInsets();
  const mode = route.params?.mode ?? 'spot';
  const { width: winW } = useWindowDimensions();
  const { width: TABLE_W, height: TABLE_H } = tableDimensions(winW - spacing.xl * 2);
  const isQuiz = mode === 'spot';
  const { dataset, recordPracticeAnswer, limitFor } = useStudy();
  const { isPremium } = useEntitlements();
  const reduced = useReducedMotion();
  // Free-first: ONE shared pool of practice questions per local day across Spot + Decision modes.
  const qLimit = limitFor('practiceQuestion');
  const [blocked] = useState(!qLimit.allowed);
  // Quiz runs are pre-sized to today's allowance so nobody is cut off mid-question.
  const [runCap, setRunCap] = useState(() => practiceRunCap(qLimit.remaining, QUIZ_LENGTH));

  const [spot, setSpot] = useState<Spot>(() => generateSpot(dataset, Math.random));
  const [result, setResult] = useState<SpotResult | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const raiseLabel = spot.range.scenario === 'vs_RFI' ? 'Raise (3-bet)' : 'Raise';
  const strategyLabel = dataset.isIllustrative ? 'Trainer range' : 'GTO play';

  // Derive a full preflop hand from the range: stacks, committed chips, pot, action order up to hero.
  const villainPos = spot.range.villainPosition as PokerPosition | undefined;
  const snapshot = useMemo(
    () =>
      buildTrainerHand({
        tableSize: spot.range.tableSize,
        scenario: spot.range.scenario,
        heroPosition: spot.range.heroPosition as PokerPosition,
        villainPosition: villainPos,
        stackBb: spot.range.stackBb,
        openSizeBb: spot.range.openSizeBb,
      }),
    [spot.range, villainPos],
  );

  // Full ring of seats so the table shows every player — hero, the in-hand opponent(s), stacks, and who folded.
  const trainerSeats: SeatProps[] = useMemo(
    () =>
      snapshot.seats.map(s => {
        const isHero = s.state === 'hero';
        const isVillain = !!villainPos && s.position === villainPos;
        // Reveal hero's chosen action after answering; show opponents' live actions (raise) but not folds (the
        // dimmed seat + timeline already convey folds).
        const seatAction = isHero
          ? result
            ? (result.chosen as PlayerAction)
            : undefined
          : s.action && s.action !== 'fold'
            ? s.action
            : undefined;
        return {
          name: isHero ? 'You' : isVillain ? 'Villain' : s.state === 'active' ? 'To act' : '',
          position: s.position,
          state: s.state,
          anonymous: !isHero,
          isDealer: s.position === 'BTN',
          stackBb: s.stackBb,
          committedBb: s.committedBb,
          isNext: s.isNext && !result,
          allin: s.allin,
          action: seatAction,
        };
      }),
    [snapshot, villainPos, result],
  );

  const toCallLabel = Number.isInteger(snapshot.toCallBb) ? String(snapshot.toCallBb) : snapshot.toCallBb.toFixed(1);

  useEffect(() => {
    if (blocked) return; // do not start a session the user can't run
    track('study_trainer_started', { mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finishSession() {
    const acc = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;
    track('study_trainer_finished', { mode, score_band: acc >= 80 ? '80-100' : acc >= 50 ? '50-79' : '0-49' });
    setDone(true);
    // Contextual permission moment (0.3): the FIRST completed drill — the OS prompt fires at most
    // once ever (persisted marker inside), native-only, and only while reminders are enabled.
    if (isFeatureEnabled('reminders') && answered > 0) void requestReminderPermissionOnce();
  }

  async function choose(action: RangeAction) {
    if (result) return; // already revealed
    if (!limitFor('practiceQuestion').allowed) return; // belt-and-braces: never answer past the pool
    const r = evaluateSpot(spot.range, spot.hand, action);
    setResult(r);
    setAnswered(a => a + 1);
    if (r.correct) setCorrectCount(c => c + 1);
    track('study_spot_answered', { mode, correct: r.correct });
    // ONE commit records the answer AND consumes one from the shared daily pool (Spot + Decision).
    await recordPracticeAnswer(r.correct);
  }

  function next() {
    if (isQuiz && answered >= runCap) { finishSession(); return; }
    // Decision mode drills until the shared daily pool runs dry, then ends with results intact.
    if (!isQuiz && !limitFor('practiceQuestion').allowed) { finishSession(); return; }
    setSpot(generateSpot(dataset, Math.random));
    setResult(null);
  }

  if (blocked) {
    return (
      <Screen>
        <BrandHeader variant="screen" title={isQuiz ? 'Spot Trainer' : 'Decision Trainer'} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ContentContainer>
            <LockNudge
              title="Daily free limit reached"
              comingSoonBody="Daily free limit reached — resets at midnight. Unlimited practice is coming soon."
              upgradeBody="You've used today's free practice questions. Go unlimited with Premium."
              trigger="trainer_daily_limit"
              icon="time-outline"
            />
          </ContentContainer>
        </View>
      </Screen>
    );
  }

  if (done) {
    const acc = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;
    return (
      <Screen>
        {acc >= 70 ? <Celebration variant="success" /> : null}
        <BrandHeader variant="screen" title={isQuiz ? 'Quiz complete' : 'Session complete'} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <MotiView {...successPop({ reduced })}>
            <Card variant="hero" style={styles.resultCard}>
              <Text style={styles.resultScore}>{correctCount}/{answered}</Text>
              <AnimatedNumber value={acc} format={(n) => `${n}% correct`} style={styles.resultAcc} />
              <Text style={styles.resultSub}>
                {acc >= 80 ? 'Sharp reads. Keep the streak alive.' : 'Good reps — run it back to improve.'}
              </Text>
            </Card>
          </MotiView>
          <View style={styles.doneBtns}>
            {limitFor('practiceQuestion').allowed && (
              <PrimaryButton label="Train again" variant="gradient" onPress={() => {
                const fresh = limitFor('practiceQuestion');
                if (!fresh.allowed) return;
                setRunCap(practiceRunCap(fresh.remaining, QUIZ_LENGTH));
                setAnswered(0); setCorrectCount(0); setResult(null); setDone(false);
                setSpot(generateSpot(dataset, Math.random));
              }} />
            )}
            <PrimaryButton label="Done" variant="outline" onPress={() => navigation.goBack()} />
            {isFeatureEnabled('retention') && isFeatureEnabled('coach') && (
              <CrossPillarCTA
                icon="sparkles"
                label="Try a real hand with AI Coach"
                sub="Turn this study into a live read"
                onPress={() => navigation.navigate('CoachInput', { method: 'manual' })}
              />
            )}
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <BrandHeader
        variant="screen"
        title={isQuiz ? 'Spot Trainer' : 'Decision Trainer'}
        subtitle={isQuiz ? `${Math.min(answered + (result ? 0 : 1), runCap)} / ${runCap}` : `✓ ${correctCount} / ${answered}`}
        onBack={() => navigation.goBack()}
        right={!isQuiz && answered > 0 ? (
          <PressableScale onPress={finishSession} hitSlop={8} accessibilityRole="button" accessibilityLabel="Finish session">
            <Text style={styles.finishText}>Finish</Text>
          </PressableScale>
        ) : undefined}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ContentContainer style={styles.stack}>
        <View style={styles.limitRow} accessible accessibilityLabel={qLimit.remaining === Infinity ? 'Unlimited practice questions with Premium' : `${qLimit.remaining} free questions left today`}>
          <Chip
            label={qLimit.remaining === Infinity ? 'Unlimited questions' : `${qLimit.remaining} free question${qLimit.remaining === 1 ? '' : 's'} left today`}
            tone={qLimit.remaining === Infinity ? 'gold' : 'neutral'}
            icon="time-outline"
          />
        </View>
        {isQuiz && (
          <ProgressBar
            value={Math.min(answered + (result ? 0 : 1), runCap) / Math.max(1, runCap)}
            height={6}
            accessibilityLabel={`Spot ${Math.min(answered + (result ? 0 : 1), runCap)} of ${runCap}`}
          />
        )}
        {!isQuiz && (
          <View style={styles.statsStrip}>
            <Text style={styles.statItem}>Answered <Text style={styles.statVal}>{answered}</Text></Text>
            <Text style={styles.statItem}>Correct <Text style={styles.statVal}>{correctCount}</Text></Text>
            <Text style={styles.statItem}>Accuracy <Text style={styles.statVal}>{answered > 0 ? `${Math.round((correctCount / answered) * 100)}%` : '—'}</Text></Text>
          </View>
        )}
        {isFeatureEnabled('immersive') ? (
          <View style={styles.tableWrap}>
            <Text style={styles.context}>{spot.range.stackBb}bb · {spot.range.tableSize}-max</Text>
            <Text style={styles.prompt}>
              {spot.range.scenario === 'RFI'
                ? `${spot.range.heroPosition} — first in. Open or fold?`
                : `${spot.range.heroPosition} vs ${spot.range.villainPosition} open. Your move?`}
            </Text>
            <ActionTimeline steps={snapshot.timeline} />
            <View style={styles.tableSceneWrapper}>
              <TableScene
                players={trainerSeats}
                width={TABLE_W}
                height={TABLE_H}
                potBb={snapshot.potBb}
                heroCards={<HoleCards hand={spot.hand} size="sm" />}
                style={styles.tableScene}
              />
            </View>
            <Text style={styles.seatLegend}>
              {snapshot.toCallBb > 0 ? `Facing ${toCallLabel}bb to call · ` : 'First to act · '}
              opponents' cards stay hidden
            </Text>
          </View>
        ) : (
          <Card style={styles.spotCard}>
            <Text style={styles.context}>{spot.range.stackBb}bb · {spot.range.tableSize}-max</Text>
            <Text style={styles.prompt}>
              {spot.range.scenario === 'RFI'
                ? `${spot.range.heroPosition} — first in. Open or fold?`
                : `${spot.range.heroPosition} vs ${spot.range.villainPosition} open. Your move?`}
            </Text>
            <HandCards hand={spot.hand} />
            {spot.range.openSizeBb ? (
              <Text style={styles.sizing}>Open size ≈ {spot.range.openSizeBb}bb</Text>
            ) : null}
          </Card>
        )}

        {result ? (
          <Card style={[styles.feedback, result.correct ? styles.feedbackOk : styles.feedbackBad]}>
            <View style={styles.feedbackHead}>
              {result.correct ? (
                <MotiView {...successPop({ reduced })}>
                  <Ionicons name="checkmark-circle" size={iconSize.sm} color={colors.success} />
                </MotiView>
              ) : (
                <Ionicons name="close-circle" size={iconSize.sm} color={colors.error} />
              )}
              <Text style={[styles.feedbackTitle, { color: result.correct ? colors.success : colors.error }]}>
                {result.correct ? 'Correct' : 'Not quite'}
              </Text>
            </View>
            <Text style={styles.feedbackBody}>
              {strategyLabel}: {result.strategy.map(s => `${ACTION_LABEL[s.action]} ${Math.round(s.freq * 100)}%`).join(' · ')}
            </Text>
            {dataset.isIllustrative ? (
              <Text style={styles.illustrativeNote}>Illustrative training range — not solver output.</Text>
            ) : null}
          </Card>
        ) : null}
        </ContentContainer>
      </ScrollView>

      {/* Pinned action footer — the primary action (Fold/Call/Raise, or Next) is ALWAYS visible,
          never clipped, and safe-area aware. Table/feedback scroll above it. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <ContentContainer>
          {result ? (
            <PrimaryButton
              label={isQuiz && answered >= runCap ? 'See results' : 'Next spot'}
              variant="gradient"
              onPress={next}
            />
          ) : (
            <View style={styles.actions}>
              {spot.options.map(opt => {
                const label = opt === 'raise' ? raiseLabel : ACTION_LABEL[opt];
                return (
                  <PressableScale
                    key={opt}
                    onPress={() => choose(opt)}
                    haptic="medium"
                    style={styles.actionBtn}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                  >
                    <Text style={styles.actionText}>{label}</Text>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </ContentContainer>
      </View>
    </Screen>
  );
}

const RED = new Set(['♥', '♦']);
function suitsFor(hand: string): [string, string] {
  if (hand.length === 2) return ['♠', '♥'];       // pair → two suits
  return hand.endsWith('s') ? ['♠', '♠'] : ['♠', '♥']; // suited same, offsuit different
}
function rankLabel(r: string): string { return r === 'T' ? '10' : r; }

function HandCards({ hand }: { hand: string }) {
  const r1 = hand[0];
  const r2 = hand[1];
  const [s1, s2] = suitsFor(hand);
  return (
    <View style={styles.cards}>
      {[[r1, s1], [r2, s2]].map(([r, s], i) => (
        <View key={i} style={styles.card}>
          <Text style={[styles.cardRank, RED.has(s) && styles.cardRed]}>{rankLabel(r)}</Text>
          <Text style={[styles.cardSuit, RED.has(s) && styles.cardRed]}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  stack: { gap: spacing.lg },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  center: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center', gap: spacing.xl },
  spotCard: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  tableWrap: { alignItems: 'center', gap: spacing.sm },
  tableSceneWrapper: { alignSelf: 'center' },
  tableScene: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xl + spacing.md },
  seatLegend: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  context: { ...typography.caps, color: colors.textMuted },
  prompt: { ...typography.h3, color: colors.text, textAlign: 'center' },
  sizing: { ...typography.bodySmall, color: colors.textMuted },
  cards: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.sm },
  card: {
    width: 76, height: 104, borderRadius: radii.md, backgroundColor: colors.surfaceHigh,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  cardRank: { ...typography.amountLarge, color: colors.textHigh },
  cardSuit: { fontSize: 24, color: colors.textHigh, marginTop: -4 },
  cardRed: { color: colors.error },
  actions: { gap: spacing.sm },
  actionBtn: {
    paddingVertical: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  actionText: { ...typography.h4, color: colors.text },
  feedback: { gap: spacing.xs, borderWidth: 1 },
  feedbackOk: { borderColor: 'rgba(39,174,96,0.4)' },
  feedbackBad: { borderColor: colors.errorMuted },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feedbackTitle: { ...typography.h4 },
  feedbackBody: { ...typography.body, color: colors.textHigh },
  illustrativeNote: { ...typography.bodySmall, color: colors.textMuted },
  resultCard: { alignItems: 'center', gap: spacing.xs },
  resultScore: { ...typography.amountHero, color: colors.gold },
  resultAcc: { ...typography.h3, color: colors.textHigh },
  resultSub: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  doneBtns: { gap: spacing.sm },
  finishText: { ...typography.label, color: colors.gold },
  statsStrip: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  statItem: { ...typography.bodySmall, color: colors.textMuted },
  statVal: { ...typography.label, color: colors.text },
  limitRow: { flexDirection: 'row' },
});

