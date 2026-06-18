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
import PressableScale from '../../../components/motion/PressableScale';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { showToast } from '../../../utils/toast';
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
    const input = build();
    if (!input) return;
    const { analysis, error: err } = await analyze(input);
    if (err === 'requires_account') { showToast('Sign in to use AI Coach.', 'info'); return; }
    if (err === 'rate_limited') { showToast('Slow down a moment, then try again.', 'info'); return; }
    if (err === 'no_credits') { showToast('You are out of analyses this month.', 'error'); return; }
    if (analysis) navigation.replace('CoachResult', { id: analysis.id });
  }

  return (
    <Screen>
      <BrandHeader variant="screen" title={TITLES[method]} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {method === 'hand_history' && (
          <Card style={styles.formCard}>
            <AppTextInput label="Hand history" value={hh} onChangeText={setHh} placeholder="Paste the full hand history…" multiline style={styles.multiline} />
          </Card>
        )}

        {method === 'manual' && (
          <Card style={styles.formCard}>
            <View style={styles.segment}>
              {(['cash', 'mtt'] as const).map(f => (
                <PressableScale key={f} onPress={() => setFormat(f)} haptic="light" style={[styles.segBtn, format === f && styles.segBtnActive]}>
                  <Text style={[styles.segText, format === f && styles.segTextActive]}>{f === 'cash' ? 'Cash' : 'Tournament'}</Text>
                </PressableScale>
              ))}
            </View>
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
        )}

        {method === 'screenshot' && (
          <Card style={styles.formCard}>
            <View style={styles.shotPlaceholder}>
              <Ionicons name="image-outline" size={34} color={colors.textMuted} />
              <Text style={styles.shotText}>Screenshot upload is part of the Coach roadmap.</Text>
              <Text style={styles.shotSub}>Run a demo analysis to preview the coaching flow.</Text>
            </View>
          </Card>
        )}

        <Card style={styles.formCard}>
          <AppTextInput label="What do you want feedback on? (optional)" value={question} onChangeText={setQuestion} placeholder="Was my river bet too thin?" multiline />
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={method === 'screenshot' ? 'Run demo analysis' : 'Get coaching'}
          variant="gradient"
          loading={isAnalyzing}
          onPress={run}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 80, gap: spacing.md },
  formCard: { gap: spacing.md },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: 3 },
  segBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radii.sm },
  segBtnActive: { backgroundColor: colors.goldFaint },
  segText: { ...typography.label, color: colors.textMuted },
  segTextActive: { color: colors.gold },
  pair: { flexDirection: 'row', gap: spacing.md },
  pairItem: { flex: 1 },
  shotPlaceholder: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  shotText: { ...typography.label, color: colors.textHigh, textAlign: 'center' },
  shotSub: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },
  error: { ...typography.bodySmall, color: colors.error },
});
