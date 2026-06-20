import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import PressableScale from '../../../components/motion/PressableScale';
import Celebration from '../../../components/motion/Celebration';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import CrossPillarCTA from '../../../components/CrossPillarCTA';
import { isFeatureEnabled } from '../../../config/features';
import { useStudy } from '../state/StudyContext';
import { track } from '../../../utils/analytics';
import { generateSpot, evaluateSpot, type Spot, type SpotResult } from '../logic/trainer';
import type { RangeAction } from '../types';
import TableScene from '../../../components/table/TableScene';
import ActionTimeline from '../../../components/table/ActionTimeline';
import type { SeatProps } from '../../../components/table/TableSeat';
import { HoleCards } from '../../../components/table/PlayingCard';
import { buildTrainerHand } from '../../../utils/trainerHand';
import type { PokerPosition, PlayerAction } from '../../../utils/pokerTable';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'StudyTrainer'>;

const QUIZ_LENGTH = 10;
const SCREEN_W = Dimensions.get('window').width;
const TABLE_W = SCREEN_W - spacing.xl * 2;
const TABLE_H = Math.round(TABLE_W * 0.86);
const ACTION_LABEL: Record<RangeAction, string> = { fold: 'Fold', call: 'Call', raise: 'Raise' };

export default function SpotTrainerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const mode = route.params?.mode ?? 'spot';
  const isQuiz = mode === 'spot';
  const { dataset, recordAnswer } = useStudy();

  const [spot, setSpot] = useState<Spot>(() => generateSpot(dataset, Math.random));
  const [result, setResult] = useState<SpotResult | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const raiseLabel = spot.range.scenario === 'vs_RFI' ? 'Raise (3-bet)' : 'Raise';

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
    track('study_trainer_started', { mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finishSession() {
    const acc = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;
    track('study_trainer_finished', { mode, score_band: acc >= 80 ? '80-100' : acc >= 50 ? '50-79' : '0-49' });
    setDone(true);
  }

  async function choose(action: RangeAction) {
    if (result) return; // already revealed
    const r = evaluateSpot(spot.range, spot.hand, action);
    setResult(r);
    setAnswered(a => a + 1);
    if (r.correct) setCorrectCount(c => c + 1);
    track('study_spot_answered', { mode, correct: r.correct });
    await recordAnswer(r.correct);
  }

  function next() {
    if (isQuiz && answered >= QUIZ_LENGTH) { finishSession(); return; }
    setSpot(generateSpot(dataset, Math.random));
    setResult(null);
  }

  if (done) {
    const acc = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;
    return (
      <Screen>
        {acc >= 70 ? <Celebration /> : null}
        <BrandHeader variant="screen" title={isQuiz ? 'Quiz complete' : 'Session complete'} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Card variant="hero" style={styles.resultCard}>
            <Text style={styles.resultScore}>{correctCount}/{answered}</Text>
            <Text style={styles.resultAcc}>{acc}% correct</Text>
            <Text style={styles.resultSub}>
              {acc >= 80 ? 'Sharp reads. Keep the streak alive.' : 'Good reps — run it back to improve.'}
            </Text>
          </Card>
          <View style={styles.doneBtns}>
            <PrimaryButton label="Train again" variant="gradient" onPress={() => {
              setAnswered(0); setCorrectCount(0); setResult(null); setDone(false);
              setSpot(generateSpot(dataset, Math.random));
            }} />
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
        subtitle={isQuiz ? `${Math.min(answered + (result ? 0 : 1), QUIZ_LENGTH)} / ${QUIZ_LENGTH}` : `✓ ${correctCount} / ${answered}`}
        onBack={() => navigation.goBack()}
        right={!isQuiz && answered > 0 ? (
          <PressableScale onPress={finishSession} hitSlop={8} accessibilityRole="button" accessibilityLabel="Finish session">
            <Text style={styles.finishText}>Finish</Text>
          </PressableScale>
        ) : undefined}
      />
      <View style={styles.body}>
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
            <TableScene
              players={trainerSeats}
              width={TABLE_W}
              height={TABLE_H}
              potBb={snapshot.potBb}
              heroCards={<HoleCards hand={spot.hand} size="sm" />}
              style={styles.tableScene}
            />
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
            <Text style={[styles.feedbackTitle, { color: result.correct ? colors.success : colors.error }]}>
              {result.correct ? 'Correct' : 'Not quite'}
            </Text>
            <Text style={styles.feedbackBody}>
              GTO play: {result.strategy.map(s => `${ACTION_LABEL[s.action]} ${Math.round(s.freq * 100)}%`).join(' · ')}
            </Text>
          </Card>
        ) : (
          <View style={styles.actions}>
            {spot.options.map(opt => (
              <PressableScale key={opt} onPress={() => choose(opt)} haptic="medium" style={styles.actionBtn}>
                <Text style={styles.actionText}>{opt === 'raise' ? raiseLabel : ACTION_LABEL[opt]}</Text>
              </PressableScale>
            ))}
          </View>
        )}

        {result ? (
          <PrimaryButton
            label={isQuiz && answered >= QUIZ_LENGTH ? 'See results' : 'Next spot'}
            variant="gradient"
            onPress={next}
          />
        ) : null}
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
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.lg },
  center: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center', gap: spacing.xl },
  spotCard: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  tableWrap: { alignItems: 'center', gap: spacing.sm },
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
  feedbackTitle: { ...typography.h4 },
  feedbackBody: { ...typography.body, color: colors.textHigh },
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
});

