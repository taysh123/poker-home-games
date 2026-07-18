import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import AppTextInput from '../../../components/AppTextInput';
import Segmented from '../../../components/Segmented';
import { MotiView, slideUpSequence, staggerIn } from '../../../components/motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { iconSize } from '../../../theme/iconSize';
import { showToast } from '../../../utils/toast';
import { successNotification, errorNotification } from '../../../utils/haptics';
import { isFeatureEnabled } from '../../../config/features';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useCoach } from '../state/CoachContext';
import type { CoachInput } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'CoachInput'>;

const TITLES = { screenshot: 'Screenshot', hand_history: 'Paste hand history', manual: 'Manual spot' } as const;

export default function CoachInputScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const method = route.params.method;
  const reduced = useReducedMotion();
  const { analyze, isAnalyzing } = useCoach();

  // hand history
  const [hh, setHh] = useState('');
  // manual
  const [format, setFormat] = useState<'cash' | 'mtt'>('cash');
  const [stack, setStack] = useState('');
  const [heroPos, setHeroPos] = useState('');
  const [villainPos, setVillainPos] = useState('');
  const [heroHand, setHeroHand] = useState('');
  const [board, setBoard] = useState('');
  const [actions, setActions] = useState('');
  // shared
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');

  function build(): CoachInput | null {
    if (method === 'hand_history') {
      if (hh.trim().length < 10) { setError('Paste a hand history to analyze.'); return null; }
      return { kind: 'hand_history', text: hh.trim(), question: question.trim() || undefined };
    }
    if (method === 'manual') {
      if (!heroHand.trim()) { setError('Enter your hand (e.g. AKs).'); return null; }
      return {
        kind: 'manual', format,
        stackBb: stack.trim() ? parseInt(stack, 10) : undefined,
        heroPosition: heroPos.trim() || undefined,
        villainPosition: villainPos.trim() || undefined,
        heroHand: heroHand.trim(),
        board: board.trim() || undefined,
        actions: actions.trim() || undefined,
        question: question.trim() || undefined,
      };
    }
    // screenshot — image upload is a planned input; run the flow with a demo reference
    return { kind: 'screenshot', imageUri: 'demo', note: question.trim() || undefined };
  }

  async function run() {
    setError('');
    const input = build();
    if (!input) { errorNotification(); return; }
    const { analysis, error: err } = await analyze(input);
    if (err === 'requires_account') { showToast('Sign in to use AI Coach.', 'info'); return; }
    if (err === 'rate_limited') { showToast('Slow down a moment, then try again.', 'info'); return; }
    if (err === 'unavailable') { errorNotification(); showToast('AI Coach is unavailable right now. Try again.', 'error'); return; }
    if (err === 'no_credits') {
      if (isFeatureEnabled('paywall')) {
        showToast('You are out of AI analyses.', 'info');
        navigation.replace('Paywall', { trigger: 'coach_no_credits' });
      } else {
        // No paywall yet → don't dead-end on a bare toast; set an honest expectation.
        showToast("That's your free analysis used — more is coming with Premium.", 'info');
      }
      return;
    }
    if (analysis) { successNotification(); navigation.replace('CoachResult', { id: analysis.id }); }
  }

  return (
    <Screen>
      <BrandHeader variant="screen" title={TITLES[method]} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {method === 'hand_history' && (
          <MotiView {...slideUpSequence({ reduced })}>
            <Card style={styles.formCard}>
              <AppTextInput label="Hand history" value={hh} onChangeText={setHh} placeholder="Paste the full hand history…" multiline style={styles.multiline} />
            </Card>
          </MotiView>
        )}

        {method === 'manual' && (
          <MotiView {...slideUpSequence({ reduced })}>
            <Card style={styles.formCard}>
              <Segmented
                options={['Cash', 'Tournament']}
                selectedIndex={format === 'cash' ? 0 : 1}
                onChange={(i) => setFormat(i === 0 ? 'cash' : 'mtt')}
                accessibilityLabel="Game format"
              />
              <View style={styles.pair}>
                <View style={styles.pairItem}><AppTextInput label="Hero hand" value={heroHand} onChangeText={setHeroHand} placeholder="AKs" autoCapitalize="characters" /></View>
                <View style={styles.pairItem}><AppTextInput label="Stack (bb)" value={stack} onChangeText={setStack} keyboardType="number-pad" placeholder="100" /></View>
              </View>
              <View style={styles.pair}>
                <View style={styles.pairItem}><AppTextInput label="Hero position" value={heroPos} onChangeText={setHeroPos} placeholder="BTN" autoCapitalize="characters" /></View>
                <View style={styles.pairItem}><AppTextInput label="Villain position" value={villainPos} onChangeText={setVillainPos} placeholder="BB" autoCapitalize="characters" /></View>
              </View>
              <AppTextInput label="Board (optional)" value={board} onChangeText={setBoard} placeholder="Ks 8d 3c" autoCapitalize="characters" />
              <AppTextInput label="Action line (optional)" value={actions} onChangeText={setActions} placeholder="Raise 2.5bb, BB calls, c-bet flop…" multiline />
            </Card>
          </MotiView>
        )}

        {method === 'screenshot' && (
          <MotiView {...slideUpSequence({ reduced })}>
            <Card style={styles.formCard}>
              <View style={styles.shotPlaceholder}>
                <Ionicons name="image-outline" size={iconSize.lg} color={colors.textMuted} />
                <Text style={styles.shotText}>Screenshot upload is part of the Coach roadmap.</Text>
                <Text style={styles.shotSub}>Run a demo analysis to preview the coaching flow.</Text>
              </View>
            </Card>
          </MotiView>
        )}

        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(1) })}>
          <Card style={styles.formCard}>
            <AppTextInput label="What do you want feedback on? (optional)" value={question} onChangeText={setQuestion} placeholder="Was my river bet too thin?" multiline />
          </Card>
        </MotiView>

        {error ? (
          <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive" accessibilityLabel={error}>
            <Ionicons name="alert-circle-outline" size={iconSize.xs} color={colors.error} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(2) })}>
          <PrimaryButton
            label={method === 'screenshot' ? 'Run demo analysis' : 'Get coaching'}
            variant="gradient"
            loading={isAnalyzing}
            onPress={run}
            accessibilityLabel={method === 'screenshot' ? 'Run demo analysis' : 'Get coaching feedback'}
          />
        </MotiView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 80, gap: spacing.md },
  formCard: { gap: spacing.md },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  pair: { flexDirection: 'row', gap: spacing.md },
  pairItem: { flex: 1 },
  shotPlaceholder: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  shotText: { ...typography.label, color: colors.textHigh, textAlign: 'center' },
  shotSub: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  error: { ...typography.bodySmall, color: colors.error, flex: 1 },
});
