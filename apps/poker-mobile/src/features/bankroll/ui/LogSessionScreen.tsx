import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import SectionTitle from '../../../components/SectionTitle';
import PrimaryButton from '../../../components/PrimaryButton';
import AppTextInput from '../../../components/AppTextInput';
import PressableScale from '../../../components/motion/PressableScale';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { confirmDialog } from '../../../utils/confirm';
import { showToast } from '../../../utils/toast';
import { track } from '../../../utils/analytics';
import { isFeatureEnabled } from '../../../config/features';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useBankroll } from '../state/BankrollContext';
import type { BankrollGameType, BankrollSource } from '../types';
import type { CreateSessionInput } from '../data/bankrollStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'LogSession'>;

/** Parse money input to integer cents; empty → 0; invalid → null. Allows 0 (e.g. busted payout). */
function toCents(input: string): number | null {
  const t = input.trim().replace(/,/g, '');
  if (t === '') return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [w, f = ''] = t.split('.');
  return parseInt(w, 10) * 100 + parseInt(f.padEnd(2, '0') || '0', 10);
}
function toCount(input: string): number {
  const n = parseInt(input.trim() || '0', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function LogSessionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const editingId = route.params?.sessionId;
  const { sessions, addSession, updateSession, deleteSession } = useBankroll();
  const existing = useMemo(() => sessions.find(s => s.id === editingId), [sessions, editingId]);

  const [gameType, setGameType] = useState<BankrollGameType>(existing?.gameType ?? 'tournament');
  const [source, setSource] = useState<BankrollSource>(existing?.source ?? 'external');
  const [date, setDate] = useState(existing ? existing.startedAt.slice(0, 10) : todayStr());
  const [venue, setVenue] = useState(existing?.venue ?? '');
  const [durationMin, setDurationMin] = useState(existing?.durationMinutes ? String(existing.durationMinutes) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');

  // Cash
  const [cashBuyIn, setCashBuyIn] = useState(existing?.cash ? String(existing.cash.buyInCents / 100) : '');
  const [cashOut, setCashOut] = useState(existing?.cash ? String(existing.cash.cashOutCents / 100) : '');
  // Tournament
  const [tBuyIn, setTBuyIn] = useState(existing?.tournament ? String(existing.tournament.buyInCents / 100) : '');
  const [tFee, setTFee] = useState(existing?.tournament ? String(existing.tournament.feeCents / 100) : '');
  const [tRebuy, setTRebuy] = useState(existing?.tournament ? String(existing.tournament.rebuyCents / 100) : '');
  const [tAddOn, setTAddOn] = useState(existing?.tournament ? String(existing.tournament.addOnCents / 100) : '');
  const [tPayout, setTPayout] = useState(existing?.tournament ? String(existing.tournament.payoutCents / 100) : '');
  const [tBounty, setTBounty] = useState(existing?.tournament ? String(existing.tournament.bountyCents / 100) : '');
  const [tEntrants, setTEntrants] = useState(existing?.tournament?.entrants ? String(existing.tournament.entrants) : '');
  const [tFinish, setTFinish] = useState(existing?.tournament?.finishPlace ? String(existing.tournament.finishPlace) : '');
  // Common
  const [fees, setFees] = useState(existing ? String(existing.feesCents / 100) : '');
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isCash = gameType === 'cash';
  const useNativeDate = isFeatureEnabled('polish') && Platform.OS !== 'web';

  function build(): CreateSessionInput | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Enter a valid date (YYYY-MM-DD).'); return null; }
    const startedAt = new Date(`${date}T12:00:00`).toISOString();
    const feesCents = toCents(fees);
    if (feesCents === null) { setError('Fees must be a number.'); return null; }

    const common = {
      gameType,
      source,
      startedAt,
      venue: venue.trim() || undefined,
      durationMinutes: durationMin.trim() ? toCount(durationMin) : undefined,
      notes: notes.trim() || undefined,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      feesCents,
    };

    if (isCash) {
      const buyInCents = toCents(cashBuyIn);
      const cashOutCents = toCents(cashOut);
      if (buyInCents === null || cashOutCents === null) { setError('Buy-in and cash-out must be numbers.'); return null; }
      if (buyInCents <= 0) { setError('Cash buy-in is required.'); return null; }
      return { ...common, cash: { buyInCents, cashOutCents } };
    }

    const buyInCents = toCents(tBuyIn);
    const feeC = toCents(tFee);
    const rebuyCents = toCents(tRebuy);
    const addOnCents = toCents(tAddOn);
    const payoutCents = toCents(tPayout);
    const bountyCents = toCents(tBounty);
    if ([buyInCents, feeC, rebuyCents, addOnCents, payoutCents, bountyCents].some(v => v === null)) {
      setError('Tournament amounts must be numbers.'); return null;
    }
    if ((buyInCents ?? 0) <= 0) { setError('Tournament buy-in is required.'); return null; }
    return {
      ...common,
      tournament: {
        buyInCents: buyInCents!, feeCents: feeC!,
        rebuyCount: rebuyCents! > 0 ? 1 : 0, rebuyCents: rebuyCents!,
        addOnCount: addOnCents! > 0 ? 1 : 0, addOnCents: addOnCents!,
        bountyCents: bountyCents!, payoutCents: payoutCents!,
        entrants: tEntrants.trim() ? toCount(tEntrants) : undefined,
        finishPlace: tFinish.trim() ? toCount(tFinish) : undefined,
      },
    };
  }

  async function save() {
    const input = build();
    if (!input) return;
    if (editingId) {
      await updateSession(editingId, input);
      showToast('Session updated.', 'success');
    } else {
      await addSession(input);
      track('bankroll_session_logged', { gameType: input.gameType, source: input.source });
      showToast('Session logged.', 'success');
    }
    navigation.goBack();
  }

  function remove() {
    if (!editingId) return;
    confirmDialog('Delete session?', 'This permanently removes this session from your bankroll.', 'Delete', async () => {
      await deleteSession(editingId);
      showToast('Session deleted.', 'info');
      navigation.goBack();
    }, { destructive: true });
  }

  return (
    <Screen>
      <BrandHeader variant="screen" title={editingId ? 'Edit Session' : 'Log Session'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Segmented
          options={[{ k: 'tournament', label: 'Tournament' }, { k: 'cash', label: 'Cash' }]}
          value={gameType}
          onChange={k => setGameType(k as BankrollGameType)}
        />
        <Segmented
          options={[{ k: 'external', label: 'External' }, { k: 'in_app', label: 'In app' }]}
          value={source}
          onChange={k => setSource(k as BankrollSource)}
        />

        <Card style={styles.formCard}>
          {useNativeDate ? (
            <View>
              <Text style={styles.fieldLabel}>Date</Text>
              <PressableScale
                style={styles.dateBtn}
                onPress={() => setShowDatePicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`Date, ${date}`}
              >
                <Ionicons name="calendar-outline" size={16} color={colors.gold} />
                <Text style={styles.dateText}>
                  {new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </Text>
              </PressableScale>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(`${date}T12:00:00`)}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={(_, d) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (d) setDate(d.toISOString().slice(0, 10));
                  }}
                />
              )}
            </View>
          ) : (
            <AppTextInput label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
          )}
          <AppTextInput label="Venue / site (optional)" value={venue} onChangeText={setVenue} placeholder="Aria, Home game, PokerStars…" />

          {isCash ? (
            <>
              <AppTextInput label="Buy-in (total)" value={cashBuyIn} onChangeText={setCashBuyIn} keyboardType="decimal-pad" prefix="₪" placeholder="0" />
              <AppTextInput label="Cash-out" value={cashOut} onChangeText={setCashOut} keyboardType="decimal-pad" prefix="₪" placeholder="0" />
            </>
          ) : (
            <>
              <AppTextInput label="Buy-in" value={tBuyIn} onChangeText={setTBuyIn} keyboardType="decimal-pad" prefix="₪" placeholder="0" />
              <AppTextInput label="Fee / rake" value={tFee} onChangeText={setTFee} keyboardType="decimal-pad" prefix="₪" placeholder="0" />
              <AppTextInput label="Rebuys (total)" value={tRebuy} onChangeText={setTRebuy} keyboardType="decimal-pad" prefix="₪" placeholder="0" />
              <AppTextInput label="Add-ons (total)" value={tAddOn} onChangeText={setTAddOn} keyboardType="decimal-pad" prefix="₪" placeholder="0" />
              <AppTextInput label="Payout / winnings" value={tPayout} onChangeText={setTPayout} keyboardType="decimal-pad" prefix="₪" placeholder="0" />
              <AppTextInput label="Bounties (optional)" value={tBounty} onChangeText={setTBounty} keyboardType="decimal-pad" prefix="₪" placeholder="0" />
              <View style={styles.pairRow}>
                <View style={styles.pairItem}><AppTextInput label="Field size" value={tEntrants} onChangeText={setTEntrants} keyboardType="number-pad" placeholder="—" /></View>
                <View style={styles.pairItem}><AppTextInput label="Finish place" value={tFinish} onChangeText={setTFinish} keyboardType="number-pad" placeholder="—" /></View>
              </View>
            </>
          )}

          <View style={styles.pairRow}>
            <View style={styles.pairItem}><AppTextInput label="Other fees (optional)" value={fees} onChangeText={setFees} keyboardType="decimal-pad" prefix="₪" placeholder="0" /></View>
            <View style={styles.pairItem}><AppTextInput label="Duration (min)" value={durationMin} onChangeText={setDurationMin} keyboardType="number-pad" placeholder="—" /></View>
          </View>

          <AppTextInput label="Tags (comma separated)" value={tags} onChangeText={setTags} placeholder="home, online, deep…" autoCapitalize="none" />
          <AppTextInput label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="How did it go?" multiline />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>

        <PrimaryButton label={editingId ? 'Save changes' : 'Log session'} variant="gradient" onPress={save} />
        {editingId ? (
          <PressableScale onPress={remove} haptic="medium" style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Delete session</Text>
          </PressableScale>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Segmented({ options, value, onChange }: {
  options: { k: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map(o => (
        <PressableScale
          key={o.k}
          onPress={() => onChange(o.k)}
          haptic="light"
          style={[styles.segmentBtn, value === o.k && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, value === o.k && styles.segmentTextActive]}>{o.label}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 80, gap: spacing.md },
  formCard: { gap: spacing.md },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radii.sm },
  segmentBtnActive: { backgroundColor: colors.goldFaint },
  segmentText: { ...typography.label, color: colors.textMuted },
  segmentTextActive: { color: colors.gold },
  pairRow: { flexDirection: 'row', gap: spacing.md },
  pairItem: { flex: 1 },
  error: { ...typography.bodySmall, color: colors.error },
  fieldLabel: { ...typography.labelSmall, color: colors.textMuted, marginBottom: 6 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 14, minHeight: 48,
  },
  dateText: { ...typography.body, color: colors.text },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing.md },
  deleteText: { ...typography.label, color: colors.error },
});
