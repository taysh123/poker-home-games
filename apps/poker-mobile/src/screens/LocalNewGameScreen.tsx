import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import { RootStackParamList } from '../navigation/AppNavigator';
import AppTextInput from '../components/AppTextInput';
import PrimaryButton from '../components/PrimaryButton';
import StepIndicator from '../components/StepIndicator';
import GuestNameInput from '../components/GuestNameInput';
import Screen from '../components/Screen';
import Chip from '../components/Chip';
import DealInOverlay from '../components/DealInOverlay';
import ScreenHeader from '../components/ScreenHeader';
import { PressableScale, MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { getRecentGuests, recordGuestName } from '../utils/guestHistory';
import { parseAmountToCents, formatCents } from '../utils/money';
import { currencySymbol } from '../utils/currency';
import { useLocalGames } from '../context/LocalGamesContext';
import { showToast } from '../utils/toast';
import { infoDialog } from '../utils/confirm';
import { PAYOUT_PRESET_LABELS, PAYOUT_PRESETS, defaultPayoutSplit } from '../local/tournament';
import { BLIND_PRESET_LABELS, generateBlindLevels, nextBlindLevel } from '../local/blinds';
import type { BlindLevel, BlindPreset, PayoutPreset } from '../local/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LocalNewGame'>;

const WINNERS_MAX = 20;
/** Curated default payout splits for common winner counts (each sums to 100).
 *  Counts beyond this fall back to `defaultPayoutSplit(n)`. */
const DEFAULT_PAYOUTS: Record<number, number[]> = {
  1: [100],
  2: [65, 35],
  3: [50, 30, 20],
  4: [40, 30, 20, 10],
  5: [35, 25, 20, 12, 8],
  6: [30, 22, 18, 13, 10, 7],
};

/**
 * Spread-ready entrance props for MotiView. The DS motion recipe's transition
 * union is looser than MotiView's discriminated transition prop, so we cast at
 * the boundary (type-only — identical runtime) and keep the DS recipes untouched.
 */
const entrance = (opts?: Parameters<typeof slideUpSequence>[0]) =>
  slideUpSequence(opts) as unknown as React.ComponentProps<typeof MotiView>;

/**
 * Local-only New Game wizard — no account, no network. Mirrors the NewGame
 * wizard UX but every player is a named local player stored on-device.
 */
export default function LocalNewGameScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const sym = currencySymbol();
  const { startGame, activeGame } = useLocalGames();

  const [step, setStep] = useState(1);
  const STEP_LABELS = ['Details', 'Players', 'Review'];
  const reduced = useReducedMotion();
  const [starting, setStarting] = useState(false);
  const [dealtGameId, setDealtGameId] = useState<string | null>(null);

  const defaultName = (() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[new Date().getDay()]} Night`;
  })();
  const [gameName, setGameName] = useState(defaultName);
  const [nameError, setNameError] = useState('');
  const [chipRatio, setChipRatio] = useState('');
  const [defaultBuyIn, setDefaultBuyIn] = useState('');
  const [buyInError, setBuyInError] = useState('');

  // Tournament mode (preselectable via the home-surface entry cards)
  const [mode, setMode] = useState<'cash' | 'tournament'>(route.params?.mode ?? 'cash');
  const [entryFee, setEntryFee] = useState('');
  const [entryFeeError, setEntryFeeError] = useState('');
  const isTournament = mode === 'tournament';

  // Payout structure — editable percentages; winners count drives the rows.
  const [winners, setWinners] = useState(3);
  const [payoutPcts, setPayoutPcts] = useState<string[]>(DEFAULT_PAYOUTS[3].map(String));
  const payoutSum = payoutPcts.reduce((s, p) => s + (parseInt(p, 10) || 0), 0);
  const payoutValid = payoutSum === 100;

  function setWinnerCount(n: number) {
    const clamped = Math.max(1, Math.min(WINNERS_MAX, n));
    setWinners(clamped);
    setPayoutPcts((DEFAULT_PAYOUTS[clamped] ?? defaultPayoutSplit(clamped)).map(String));
  }
  function applyPayoutPreset(preset: PayoutPreset) {
    const pcts = PAYOUT_PRESETS[preset];
    setWinners(pcts.length);
    setPayoutPcts(pcts.map(String));
  }

  // Blind structure — seeded from a preset, optionally edited level-by-level.
  const [blindPreset, setBlindPreset] = useState<BlindPreset>('standard');
  const [customBlinds, setCustomBlinds] = useState(false);
  const [blindLevels, setBlindLevels] = useState<BlindLevel[]>(() => generateBlindLevels('standard'));

  function pickBlindPreset(preset: BlindPreset) {
    setBlindPreset(preset);
    setCustomBlinds(false);
    setBlindLevels(generateBlindLevels(preset));
  }
  function editLevel(index: number, patch: Partial<BlindLevel>) {
    setCustomBlinds(true);
    setBlindLevels(prev => prev.map((lv, i) => (i === index ? { ...lv, ...patch } : lv)));
  }
  function addLevel() {
    setCustomBlinds(true);
    setBlindLevels(prev => [...prev, nextBlindLevel(prev)]);
  }
  function removeLevel(index: number) {
    setCustomBlinds(true);
    setBlindLevels(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  // Other tournament settings
  const [startingStack, setStartingStack] = useState('10000');
  const [rebuysAllowed, setRebuysAllowed] = useState(true);
  const [addOnsAllowed, setAddOnsAllowed] = useState(false);
  const [addOnAmount, setAddOnAmount] = useState('');
  const [lateRegLevels, setLateRegLevels] = useState(0);

  const [playerInput, setPlayerInput] = useState('');
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [playersError, setPlayersError] = useState('');
  const [recentGuests, setRecentGuests] = useState<string[]>([]);

  useEffect(() => {
    getRecentGuests().then(setRecentGuests);
  }, []);

  function goToStep(n: number) {
    setStep(n);
  }

  function addPlayerName() {
    const name = playerInput.trim();
    if (!name) return;
    if (playerNames.some(n => n.toLowerCase() === name.toLowerCase())) {
      setPlayerInput('');
      return;
    }
    setPlayerNames(prev => [...prev, name]);
    setPlayerInput('');
    setPlayersError('');
  }

  function removePlayerName(name: string) {
    setPlayerNames(prev => prev.filter(n => n !== name));
  }

  const suggestions = playerInput.trim().length > 0
    ? recentGuests.filter(g =>
        g.toLowerCase().includes(playerInput.toLowerCase()) &&
        !playerNames.some(n => n.toLowerCase() === g.toLowerCase())
      ).slice(0, 5)
    : [];

  function handleNextStep() {
    if (step === 1) {
      if (!gameName.trim()) {
        setNameError('Game name is required.');
        return;
      }
      if (isTournament && parseAmountToCents(entryFee) === null) {
        setEntryFeeError('Entry fee is required.');
        return;
      }
      if (isTournament && !payoutValid) {
        infoDialog('Payouts must total 100%', `Your payout split currently adds up to ${payoutSum}%. Adjust the places so they total 100%.`);
        return;
      }
      if (!isTournament && defaultBuyIn.trim() && parseAmountToCents(defaultBuyIn) === null) {
        setBuyInError('Enter a valid amount.');
        return;
      }
      setNameError('');
      setBuyInError('');
      setEntryFeeError('');
      goToStep(2);
    } else if (step === 2) {
      if (playerNames.length < 2) {
        setPlayersError('Add at least 2 players to settle up later.');
        return;
      }
      setPlayersError('');
      goToStep(3);
    }
  }

  async function handleStartGame() {
    if (activeGame) {
      infoDialog('Game in progress', 'Finish your current game before starting a new one.');
      return;
    }
    setStarting(true);
    try {
      const ratio = chipRatio ? parseFloat(chipRatio) : undefined;
      const buyInCents = defaultBuyIn ? parseAmountToCents(defaultBuyIn) ?? undefined : undefined;

      const game = await startGame({
        name: gameName.trim(),
        playerNames,
        chipRatio: !isTournament && ratio && Number.isFinite(ratio) ? ratio : undefined,
        defaultBuyInCents: isTournament ? undefined : buyInCents,
        mode,
        tournament: isTournament
          ? {
              entryFeeCents: parseAmountToCents(entryFee)!,
              payouts: payoutPcts.map(p => parseInt(p, 10) || 0),
              blindLevels,
              startingStackChips: startingStack ? parseInt(startingStack, 10) || undefined : undefined,
              rebuysAllowed,
              addOnsAllowed,
              addOnAmountCents: addOnsAllowed && addOnAmount ? parseAmountToCents(addOnAmount) ?? undefined : undefined,
              lateRegLevels,
            }
          : undefined,
      });

      for (const name of playerNames) {
        await recordGuestName(name);
      }

      showToast('Game started!', 'success');
      // wow #5: brief branded "Deal 'Em In" beat, then into the live table.
      setDealtGameId(game.id);
    } catch {
      infoDialog('Failed to start game', 'Please try again.');
      setStarting(false);
    }
  }

  return (
    <Screen>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Quick Game" onBack={() => step > 1 ? goToStep(step - 1) : navigation.goBack()} />

      <StepIndicator steps={STEP_LABELS} current={step} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Step 1: Details ── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Set the Table</Text>
            <View style={styles.localBadge}>
              <Ionicons name="phone-portrait-outline" size={iconSize.xs} color={colors.goldLight} />
              <Text style={styles.localBadgeText}>Stored on this device — no account needed</Text>
            </View>

            <AppTextInput
              label="Game Name"
              value={gameName}
              onChangeText={setGameName}
              placeholder={defaultName}
              error={nameError}
              autoFocus
            />

            {/* Cash / Tournament mode — first-class choice */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Game Type</Text>
              {([
                {
                  value: 'cash' as const,
                  icon: 'cash-outline' as const,
                  title: 'Cash Game',
                  blurb: 'Flexible buy-ins — settle up at the end.',
                },
                {
                  value: 'tournament' as const,
                  icon: 'trophy-outline' as const,
                  title: 'Tournament',
                  blurb: 'Entry fee, blind clock, podium payouts.',
                },
              ]).map(option => {
                const selected = mode === option.value;
                return (
                  <PressableScale
                    key={option.value}
                    style={[styles.modeCard, selected && styles.modeCardActive]}
                    onPress={() => setMode(option.value)}
                    haptic="light"
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${option.title}. ${option.blurb}`}
                  >
                    <View style={[styles.modeIconWrap, selected && styles.modeIconWrapActive]}>
                      <Ionicons name={option.icon} size={iconSize.sm} color={selected ? colors.gold : colors.textMuted} />
                    </View>
                    <View style={styles.modeCardText}>
                      <Text style={[styles.modeCardTitle, selected && styles.modeCardTitleActive]}>
                        {option.title}
                      </Text>
                      <Text style={styles.modeCardBlurb}>{option.blurb}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={iconSize.sm}
                      color={selected ? colors.gold : colors.textDim}
                    />
                  </PressableScale>
                );
              })}
            </View>

            {isTournament ? (
              <>
                <AppTextInput
                  label="Entry Fee"
                  value={entryFee}
                  onChangeText={setEntryFee}
                  placeholder="50"
                  keyboardType="decimal-pad"
                  prefix={sym}
                  error={entryFeeError}
                  hint="everyone pays this into the prize pool"
                />

                {/* ── Payouts ── */}
                <View style={styles.setupCard}>
                  <View style={styles.setupCardHead}>
                    <Text style={styles.fieldLabel}>Payouts</Text>
                    <View style={styles.stepper}>
                      <PressableScale style={styles.stepperBtn} onPress={() => setWinnerCount(winners - 1)} disabled={winners <= 1} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fewer paid places" accessibilityState={{ disabled: winners <= 1 }}>
                        <Ionicons name="remove" size={iconSize.xs} color={winners <= 1 ? colors.textDim : colors.gold} />
                      </PressableScale>
                      <Text style={styles.stepperValue}>{winners} {winners === 1 ? 'place' : 'places'}</Text>
                      <PressableScale style={styles.stepperBtn} onPress={() => setWinnerCount(winners + 1)} disabled={winners >= WINNERS_MAX} hitSlop={8} accessibilityRole="button" accessibilityLabel="More paid places" accessibilityState={{ disabled: winners >= WINNERS_MAX }}>
                        <Ionicons name="add" size={iconSize.xs} color={winners >= WINNERS_MAX ? colors.textDim : colors.gold} />
                      </PressableScale>
                    </View>
                  </View>
                  <View style={styles.chipRow}>
                    {(Object.keys(PAYOUT_PRESET_LABELS) as PayoutPreset[]).map(p => (
                      <PressableScale key={p} style={styles.miniChip} onPress={() => applyPayoutPreset(p)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Apply ${PAYOUT_PRESET_LABELS[p]} payout preset`}>
                        <Text style={styles.miniChipText}>{PAYOUT_PRESET_LABELS[p]}</Text>
                      </PressableScale>
                    ))}
                  </View>
                  {payoutPcts.map((pct, i) => (
                    <View key={i} style={styles.payoutRow}>
                      <Text style={styles.payoutRank}>{`#${i + 1}`}</Text>
                      <View style={styles.payoutInputWrap}>
                        <TextInput
                          style={styles.payoutInput}
                          value={pct}
                          onChangeText={v => setPayoutPcts(prev => prev.map((x, j) => (j === i ? v.replace(/[^0-9]/g, '') : x)))}
                          placeholder="0"
                          placeholderTextColor={colors.textDim}
                          keyboardType="number-pad"
                          accessibilityLabel={`Payout percentage for place ${i + 1}`}
                        />
                      </View>
                      <Text style={styles.payoutPct}>%</Text>
                    </View>
                  ))}
                  <View style={[styles.sumPill, payoutValid ? styles.sumPillOk : styles.sumPillWarn]} accessibilityLiveRegion="polite">
                    <Ionicons name={payoutValid ? 'checkmark-circle' : 'alert-circle'} size={iconSize.xs} color={payoutValid ? colors.success : colors.warning} />
                    <Text style={[styles.sumText, { color: payoutValid ? colors.success : colors.warning }]}>
                      {payoutValid ? 'Payouts total 100%' : `Payouts total ${payoutSum}% — must be 100%`}
                    </Text>
                  </View>
                </View>

                {/* ── Blinds ── */}
                <View style={styles.setupCard}>
                  <Text style={styles.fieldLabel}>Blind Structure</Text>
                  <View style={styles.chipRow}>
                    {(Object.keys(BLIND_PRESET_LABELS) as BlindPreset[]).map(b => {
                      const blindSelected = !customBlinds && blindPreset === b;
                      return (
                        <PressableScale
                          key={b}
                          style={[styles.presetChip, blindSelected && styles.presetChipSelected]}
                          onPress={() => pickBlindPreset(b)}
                          hitSlop={8}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: blindSelected }}
                          accessibilityLabel={`${BLIND_PRESET_LABELS[b]} blind structure`}
                        >
                          <Text style={[styles.presetChipText, blindSelected && styles.presetChipTextSelected]}>
                            {BLIND_PRESET_LABELS[b]}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                  <PressableScale
                    style={styles.disclosureRow}
                    onPress={() => setCustomBlinds(v => !v)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: customBlinds }}
                    accessibilityLabel={customBlinds ? 'Hide custom blind levels' : 'Customize blind levels'}
                  >
                    <Ionicons name={customBlinds ? 'chevron-down' : 'chevron-forward'} size={iconSize.xs} color={colors.gold} />
                    <Text style={styles.disclosureText}>
                      {customBlinds ? 'Custom structure' : `Customize levels (${blindLevels.length} levels)`}
                    </Text>
                  </PressableScale>
                  {customBlinds && (
                    <View style={styles.levelEditor}>
                      <View style={styles.levelHeadRow}>
                        <Text style={styles.hLv}>Lv</Text>
                        <Text style={styles.hCell}>SB</Text>
                        <Text style={styles.hCell}>BB</Text>
                        <Text style={styles.hCell}>Ante</Text>
                        <Text style={styles.hCell}>Min</Text>
                        <View style={styles.hRemove} />
                      </View>
                      {blindLevels.map((lv, i) => (
                        <View key={i} style={styles.levelRow}>
                          <Text style={styles.levelNum}>{i + 1}</Text>
                          <TextInput
                            style={styles.levelCell}
                            value={String(lv.smallBlind)}
                            onChangeText={v => editLevel(i, { smallBlind: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 })}
                            keyboardType="number-pad"
                            accessibilityLabel={`Small blind, level ${i + 1}`}
                          />
                          <TextInput
                            style={styles.levelCell}
                            value={String(lv.bigBlind)}
                            onChangeText={v => editLevel(i, { bigBlind: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 })}
                            keyboardType="number-pad"
                            accessibilityLabel={`Big blind, level ${i + 1}`}
                          />
                          <TextInput
                            style={styles.levelCell}
                            value={lv.ante ? String(lv.ante) : ''}
                            placeholder="—"
                            placeholderTextColor={colors.textDim}
                            onChangeText={v => editLevel(i, { ante: parseInt(v.replace(/[^0-9]/g, ''), 10) || undefined })}
                            keyboardType="number-pad"
                            accessibilityLabel={`Ante, level ${i + 1}`}
                          />
                          <TextInput
                            style={styles.levelCell}
                            value={String(Math.round(lv.durationSeconds / 60))}
                            onChangeText={v => editLevel(i, { durationSeconds: (parseInt(v.replace(/[^0-9]/g, ''), 10) || 0) * 60 })}
                            keyboardType="number-pad"
                            accessibilityLabel={`Minutes, level ${i + 1}`}
                          />
                          <PressableScale style={styles.levelRemove} onPress={() => removeLevel(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove level ${i + 1}`}>
                            <Ionicons name="close-circle" size={iconSize.xs} color={colors.textMuted} />
                          </PressableScale>
                        </View>
                      ))}
                      <PressableScale style={styles.addLevelBtn} onPress={addLevel} accessibilityRole="button" accessibilityLabel="Add blind level">
                        <Ionicons name="add" size={iconSize.xs} color={colors.gold} />
                        <Text style={styles.addLevelText}>Add level</Text>
                      </PressableScale>
                    </View>
                  )}
                </View>

                {/* ── Stack & extras ── */}
                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <AppTextInput
                      label="Starting Stack"
                      value={startingStack}
                      onChangeText={v => setStartingStack(v.replace(/[^0-9]/g, ''))}
                      placeholder="10000"
                      keyboardType="number-pad"
                      hint="chips per entry"
                    />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={styles.fieldLabel}>Late Reg</Text>
                    <View style={styles.stepper}>
                      <PressableScale style={styles.stepperBtn} onPress={() => setLateRegLevels(n => Math.max(0, n - 1))} disabled={lateRegLevels <= 0} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fewer late registration levels" accessibilityState={{ disabled: lateRegLevels <= 0 }}>
                        <Ionicons name="remove" size={iconSize.xs} color={lateRegLevels <= 0 ? colors.textDim : colors.gold} />
                      </PressableScale>
                      <Text style={styles.stepperValue}>{lateRegLevels === 0 ? 'Off' : `Lv ${lateRegLevels}`}</Text>
                      <PressableScale style={styles.stepperBtn} onPress={() => setLateRegLevels(n => Math.min(blindLevels.length, n + 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel="More late registration levels">
                        <Ionicons name="add" size={iconSize.xs} color={colors.gold} />
                      </PressableScale>
                    </View>
                  </View>
                </View>

                <PressableScale style={styles.toggleRow} onPress={() => setRebuysAllowed(v => !v)} haptic="light" accessibilityRole="switch" accessibilityState={{ checked: rebuysAllowed }} accessibilityLabel="Rebuys. Players can buy back in while they have chips.">
                  <View style={styles.toggleText}>
                    <Text style={styles.toggleTitle}>Rebuys</Text>
                    <Text style={styles.toggleBlurb}>Players can buy back in while they have chips.</Text>
                  </View>
                  <Ionicons name={rebuysAllowed ? 'toggle' : 'toggle-outline'} size={iconSize.lg} color={rebuysAllowed ? colors.gold : colors.textDim} />
                </PressableScale>

                <PressableScale style={styles.toggleRow} onPress={() => setAddOnsAllowed(v => !v)} haptic="light" accessibilityRole="switch" accessibilityState={{ checked: addOnsAllowed }} accessibilityLabel="Add-ons. One-time top-up, usually at the break.">
                  <View style={styles.toggleText}>
                    <Text style={styles.toggleTitle}>Add-ons</Text>
                    <Text style={styles.toggleBlurb}>One-time top-up, usually at the break.</Text>
                  </View>
                  <Ionicons name={addOnsAllowed ? 'toggle' : 'toggle-outline'} size={iconSize.lg} color={addOnsAllowed ? colors.gold : colors.textDim} />
                </PressableScale>
                {addOnsAllowed && (
                  <AppTextInput
                    label="Add-on Amount"
                    value={addOnAmount}
                    onChangeText={setAddOnAmount}
                    placeholder="50"
                    keyboardType="decimal-pad"
                    prefix={sym}
                    hint="added to the prize pool"
                  />
                )}
              </>
            ) : (
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <AppTextInput
                    label="Chip Ratio"
                    value={chipRatio}
                    onChangeText={setChipRatio}
                    placeholder="e.g. 100"
                    keyboardType="decimal-pad"
                    hint={`chips per ${sym}`}
                  />
                </View>
                <View style={styles.halfField}>
                  <AppTextInput
                    label="Default Buy-In"
                    value={defaultBuyIn}
                    onChangeText={setDefaultBuyIn}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    prefix={sym}
                    error={buyInError}
                  />
                </View>
              </View>
            )}

            <PrimaryButton label="Next" onPress={handleNextStep} style={styles.actionButton} />
          </View>
        )}

        {/* ── Step 2: Players ── */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Assemble Your Crew</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Add Player</Text>
              <GuestNameInput
                value={playerInput}
                onChangeText={setPlayerInput}
                onAdd={addPlayerName}
                suggestions={suggestions}
                onPickSuggestion={setPlayerInput}
                placeholder="Player name..."
              />
              {playersError ? <Text style={styles.fieldError}>{playersError}</Text> : null}
            </View>

            {playerNames.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>At the Table ({playerNames.length})</Text>
                <View style={styles.chipRow}>
                  {playerNames.map((name, i) => (
                    <MotiView key={name} {...entrance({ reduced, delay: staggerIn(i), distance: 8 })}>
                      <PressableScale style={styles.playerChip} onPress={() => removePlayerName(name)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${name}`}>
                        <Text style={styles.playerChipText}>{name}</Text>
                        <Ionicons name="close" size={iconSize.xs} color={colors.textMuted} style={{ marginLeft: spacing.xs }} />
                      </PressableScale>
                    </MotiView>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.actionRow}>
              <PrimaryButton label="Back" onPress={() => goToStep(1)} variant="outline" fullWidth={false} style={styles.stepBackBtn} />
              <PrimaryButton label="Review" onPress={handleNextStep} fullWidth={false} style={styles.nextBtn} />
            </View>
          </View>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Ready to Play?</Text>

            <MotiView {...entrance({ reduced })} style={styles.reviewCard}>
              <View style={styles.reviewAccent} />
              <View style={styles.reviewCardBody}>
                <Text style={styles.reviewName}>{gameName}</Text>
                <Text style={styles.reviewMeta}>
                  {isTournament ? 'Tournament · this device' : 'Local game · this device'}
                </Text>
                <Text style={styles.reviewPlayerCount}>
                  {playerNames.length} player{playerNames.length !== 1 ? 's' : ''} at the table
                </Text>
                <View style={styles.reviewMetaRow}>
                  {isTournament ? (
                    <>
                      {parseAmountToCents(entryFee) !== null && (
                        <Chip tone="gold" label={`${formatCents(parseAmountToCents(entryFee)!)} entry`} />
                      )}
                      <Chip tone="gold" label={`${winners}-place payout`} />
                      <Chip tone="gold" label={customBlinds ? `${blindLevels.length} custom levels` : `${blindPreset} blinds`} />
                      {rebuysAllowed && <Chip tone="gold" label="rebuys" />}
                      {addOnsAllowed && <Chip tone="gold" label="add-ons" />}
                      {lateRegLevels > 0 && <Chip tone="gold" label={`late reg · Lv ${lateRegLevels}`} />}
                    </>
                  ) : (
                    <>
                      {defaultBuyIn && parseAmountToCents(defaultBuyIn) !== null
                        ? <Chip tone="gold" label={`${formatCents(parseAmountToCents(defaultBuyIn)!)} buy-in`} />
                        : null}
                      {chipRatio ? <Chip tone="gold" label={`${chipRatio} chips/${sym}`} /> : null}
                    </>
                  )}
                </View>
              </View>
            </MotiView>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Players</Text>
              <View style={styles.chipRow}>
                {playerNames.map((name, i) => (
                  <MotiView key={name} {...entrance({ reduced, delay: staggerIn(i), distance: 8 })} style={styles.reviewPlayerChip}>
                    <Text style={styles.reviewPlayerName}>{name}</Text>
                  </MotiView>
                ))}
              </View>
            </View>

            <View style={styles.actionRow}>
              <PrimaryButton label="Back" onPress={() => goToStep(2)} variant="outline" fullWidth={false} style={styles.stepBackBtn} />
              <PrimaryButton
                label="Deal 'Em In"
                onPress={handleStartGame}
                loading={starting}
                fullWidth={false}
                style={styles.nextBtn}
              />
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
    {dealtGameId && (
      <DealInOverlay onDone={() => navigation.replace('LocalSession', { gameId: dealtGameId! })} />
    )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  scroll: { flex: 1 },
  content: { padding: spacing.xl },
  stepContent: { gap: spacing.xxl },
  stepTitle: { ...typography.h2, color: colors.text },

  localBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    marginTop: -spacing.md,
  },
  localBadgeText: { fontSize: 12, fontWeight: '600', color: colors.goldLight },

  field: { gap: spacing.md },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fieldError: { fontSize: 12, color: colors.error, marginTop: 2 },

  row: { flexDirection: 'row', gap: spacing.md },
  halfField: { flex: 1 },

  // Cash / Tournament mode cards + preset chips
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    minHeight: 64,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  modeCardActive: { borderColor: colors.gold, backgroundColor: colors.goldFaint },
  modeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIconWrapActive: { backgroundColor: colors.goldFaint, borderColor: colors.goldMuted },
  modeCardText: { flex: 1, gap: 2 },
  modeCardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  modeCardTitleActive: { color: colors.goldLight },
  modeCardBlurb: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  presetChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetChipSelected: { borderColor: colors.gold, backgroundColor: colors.goldSubtle },
  presetChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  presetChipTextSelected: { color: colors.gold },

  // Tournament setup cards
  setupCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  setupCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceHigh,
  },
  stepperBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontSize: 13, fontWeight: '700', color: colors.text, minWidth: 56, textAlign: 'center' },
  miniChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  miniChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  payoutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  payoutRank: { width: 34, fontSize: 16, textAlign: 'center' },
  payoutInputWrap: { flex: 1 },
  payoutInput: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  payoutPct: { fontSize: 15, fontWeight: '700', color: colors.textMuted, width: 18 },
  sumPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start' },
  sumPillOk: {},
  sumPillWarn: {},
  sumText: { fontSize: 12.5, fontWeight: '600' },

  disclosureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, minHeight: 44 },
  disclosureText: { fontSize: 13, fontWeight: '600', color: colors.gold },
  levelEditor: { gap: spacing.sm },
  levelHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  hLv: { width: 22, fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
  hCell: { flex: 1, fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
  hRemove: { width: 24 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  levelNum: { width: 22, fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  levelCell: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  levelRemove: { width: 24, alignItems: 'center', justifyContent: 'center' },
  addLevelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, marginTop: 2, minHeight: 44 },
  addLevelText: { fontSize: 13, fontWeight: '700', color: colors.gold },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  toggleBlurb: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    backgroundColor: colors.goldSubtle,
  },
  playerChipText: { fontSize: 13, fontWeight: '600', color: colors.gold },

  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionButton: { marginTop: spacing.sm },
  stepBackBtn: { flex: 1 },
  nextBtn: { flex: 2 },

  reviewCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    borderRadius: radii.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    ...shadows.goldSm,
  },
  reviewAccent: {
    width: 4,
    backgroundColor: colors.gold,
    borderTopLeftRadius: radii.lg,
    borderBottomLeftRadius: radii.lg,
  },
  reviewCardBody: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  reviewName: { ...typography.h2, color: colors.text },
  reviewMeta: { fontSize: 14, color: colors.textMuted },
  reviewPlayerCount: { fontSize: 13, color: colors.goldLight, fontWeight: '600' },
  reviewMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  reviewPlayerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  reviewPlayerName: { fontSize: 13, fontWeight: '600', color: colors.text },
});
