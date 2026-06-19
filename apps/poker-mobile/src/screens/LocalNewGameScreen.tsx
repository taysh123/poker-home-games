import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { typography } from '../theme/typography';
import { RootStackParamList } from '../navigation/AppNavigator';
import AppTextInput from '../components/AppTextInput';
import PrimaryButton from '../components/PrimaryButton';
import StepIndicator from '../components/StepIndicator';
import GuestNameInput from '../components/GuestNameInput';
import Screen from '../components/Screen';
import DealInOverlay from '../components/DealInOverlay';
import ScreenHeader from '../components/ScreenHeader';
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
 * Local-only New Game wizard — no account, no network. Mirrors the NewGame
 * wizard UX but every player is a named local player stored on-device.
 */
export default function LocalNewGameScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const sym = currencySymbol();
  const { startGame, activeGame } = useLocalGames();

  const [step, setStep] = useState(1);
  const STEP_LABELS = ['Details', 'Players', 'Review'];
  const reviewAnim = useRef(new Animated.Value(0)).current;
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
    if (n === 3) {
      reviewAnim.setValue(0);
      Animated.timing(reviewAnim, { toValue: 1, duration: 320, useNativeDriver: Platform.OS !== 'web' }).start();
    }
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
              <Ionicons name="phone-portrait-outline" size={13} color={colors.goldLight} />
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
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.modeCard, selected && styles.modeCardActive]}
                    onPress={() => setMode(option.value)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.modeIconWrap, selected && styles.modeIconWrapActive]}>
                      <Ionicons name={option.icon} size={20} color={selected ? colors.gold : colors.textMuted} />
                    </View>
                    <View style={styles.modeCardText}>
                      <Text style={[styles.modeCardTitle, selected && styles.modeCardTitleActive]}>
                        {option.title}
                      </Text>
                      <Text style={styles.modeCardBlurb}>{option.blurb}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? colors.gold : colors.textDim}
                    />
                  </TouchableOpacity>
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
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => setWinnerCount(winners - 1)} disabled={winners <= 1}>
                        <Ionicons name="remove" size={16} color={winners <= 1 ? colors.textDim : colors.gold} />
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{winners} {winners === 1 ? 'place' : 'places'}</Text>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => setWinnerCount(winners + 1)} disabled={winners >= WINNERS_MAX}>
                        <Ionicons name="add" size={16} color={winners >= WINNERS_MAX ? colors.textDim : colors.gold} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.chipRow}>
                    {(Object.keys(PAYOUT_PRESET_LABELS) as PayoutPreset[]).map(p => (
                      <TouchableOpacity key={p} style={styles.miniChip} onPress={() => applyPayoutPreset(p)}>
                        <Text style={styles.miniChipText}>{PAYOUT_PRESET_LABELS[p]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {payoutPcts.map((pct, i) => (
                    <View key={i} style={styles.payoutRow}>
                      <Text style={styles.payoutRank}>{i + 1 === 1 ? '🥇' : i + 1 === 2 ? '🥈' : i + 1 === 3 ? '🥉' : `#${i + 1}`}</Text>
                      <View style={styles.payoutInputWrap}>
                        <TextInput
                          style={styles.payoutInput}
                          value={pct}
                          onChangeText={v => setPayoutPcts(prev => prev.map((x, j) => (j === i ? v.replace(/[^0-9]/g, '') : x)))}
                          placeholder="0"
                          placeholderTextColor={colors.textDim}
                          keyboardType="number-pad"
                        />
                      </View>
                      <Text style={styles.payoutPct}>%</Text>
                    </View>
                  ))}
                  <View style={[styles.sumPill, payoutValid ? styles.sumPillOk : styles.sumPillWarn]}>
                    <Ionicons name={payoutValid ? 'checkmark-circle' : 'alert-circle'} size={14} color={payoutValid ? colors.success : colors.warning} />
                    <Text style={[styles.sumText, { color: payoutValid ? colors.success : colors.warning }]}>
                      {payoutValid ? 'Payouts total 100%' : `Payouts total ${payoutSum}% — must be 100%`}
                    </Text>
                  </View>
                </View>

                {/* ── Blinds ── */}
                <View style={styles.setupCard}>
                  <Text style={styles.fieldLabel}>Blind Structure</Text>
                  <View style={styles.chipRow}>
                    {(Object.keys(BLIND_PRESET_LABELS) as BlindPreset[]).map(b => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.presetChip, !customBlinds && blindPreset === b && styles.presetChipSelected]}
                        onPress={() => pickBlindPreset(b)}
                      >
                        <Text style={[styles.presetChipText, !customBlinds && blindPreset === b && styles.presetChipTextSelected]}>
                          {BLIND_PRESET_LABELS[b]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.disclosureRow} onPress={() => setCustomBlinds(v => !v)}>
                    <Ionicons name={customBlinds ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.gold} />
                    <Text style={styles.disclosureText}>
                      {customBlinds ? 'Custom structure' : `Customize levels (${blindLevels.length} levels)`}
                    </Text>
                  </TouchableOpacity>
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
                          />
                          <TextInput
                            style={styles.levelCell}
                            value={String(lv.bigBlind)}
                            onChangeText={v => editLevel(i, { bigBlind: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 })}
                            keyboardType="number-pad"
                          />
                          <TextInput
                            style={styles.levelCell}
                            value={lv.ante ? String(lv.ante) : ''}
                            placeholder="—"
                            placeholderTextColor={colors.textDim}
                            onChangeText={v => editLevel(i, { ante: parseInt(v.replace(/[^0-9]/g, ''), 10) || undefined })}
                            keyboardType="number-pad"
                          />
                          <TextInput
                            style={styles.levelCell}
                            value={String(Math.round(lv.durationSeconds / 60))}
                            onChangeText={v => editLevel(i, { durationSeconds: (parseInt(v.replace(/[^0-9]/g, ''), 10) || 0) * 60 })}
                            keyboardType="number-pad"
                          />
                          <TouchableOpacity style={styles.levelRemove} onPress={() => removeLevel(i)} hitSlop={6}>
                            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      <TouchableOpacity style={styles.addLevelBtn} onPress={addLevel}>
                        <Ionicons name="add" size={16} color={colors.gold} />
                        <Text style={styles.addLevelText}>Add level</Text>
                      </TouchableOpacity>
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
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => setLateRegLevels(n => Math.max(0, n - 1))} disabled={lateRegLevels <= 0}>
                        <Ionicons name="remove" size={16} color={lateRegLevels <= 0 ? colors.textDim : colors.gold} />
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{lateRegLevels === 0 ? 'Off' : `Lv ${lateRegLevels}`}</Text>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => setLateRegLevels(n => Math.min(blindLevels.length, n + 1))}>
                        <Ionicons name="add" size={16} color={colors.gold} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.toggleRow} onPress={() => setRebuysAllowed(v => !v)} activeOpacity={0.8}>
                  <View style={styles.toggleText}>
                    <Text style={styles.toggleTitle}>Rebuys</Text>
                    <Text style={styles.toggleBlurb}>Players can buy back in while they have chips.</Text>
                  </View>
                  <Ionicons name={rebuysAllowed ? 'toggle' : 'toggle-outline'} size={34} color={rebuysAllowed ? colors.gold : colors.textDim} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.toggleRow} onPress={() => setAddOnsAllowed(v => !v)} activeOpacity={0.8}>
                  <View style={styles.toggleText}>
                    <Text style={styles.toggleTitle}>Add-ons</Text>
                    <Text style={styles.toggleBlurb}>One-time top-up, usually at the break.</Text>
                  </View>
                  <Ionicons name={addOnsAllowed ? 'toggle' : 'toggle-outline'} size={34} color={addOnsAllowed ? colors.gold : colors.textDim} />
                </TouchableOpacity>
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
                  {playerNames.map(name => (
                    <TouchableOpacity key={name} style={styles.playerChip} onPress={() => removePlayerName(name)}>
                      <Text style={styles.playerChipText}>{name}</Text>
                      <Ionicons name="close" size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
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

            <Animated.View style={[styles.reviewCard, {
              opacity: reviewAnim,
              transform: [{ translateY: reviewAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }]}>
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
                        <Text style={styles.reviewChip}>{formatCents(parseAmountToCents(entryFee)!)} entry</Text>
                      )}
                      <Text style={styles.reviewChip}>{winners}-place payout</Text>
                      <Text style={styles.reviewChip}>{customBlinds ? `${blindLevels.length} custom levels` : `${blindPreset} blinds`}</Text>
                      {rebuysAllowed && <Text style={styles.reviewChip}>rebuys</Text>}
                      {addOnsAllowed && <Text style={styles.reviewChip}>add-ons</Text>}
                      {lateRegLevels > 0 && <Text style={styles.reviewChip}>late reg · Lv {lateRegLevels}</Text>}
                    </>
                  ) : (
                    <>
                      {defaultBuyIn && parseAmountToCents(defaultBuyIn) !== null
                        ? <Text style={styles.reviewChip}>{formatCents(parseAmountToCents(defaultBuyIn)!)} buy-in</Text>
                        : null}
                      {chipRatio ? <Text style={styles.reviewChip}>{chipRatio} chips/{sym}</Text> : null}
                    </>
                  )}
                </View>
              </View>
            </Animated.View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Players</Text>
              <View style={styles.chipRow}>
                {playerNames.map(name => (
                  <View key={name} style={styles.reviewPlayerChip}>
                    <Text style={styles.reviewPlayerName}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.actionRow}>
              <PrimaryButton label="Back" onPress={() => goToStep(2)} variant="outline" fullWidth={false} style={styles.stepBackBtn} />
              <PrimaryButton
                label="Deal 'Em In 🃏"
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
  content: { padding: 20 },
  stepContent: { gap: 24 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: colors.text },

  localBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    marginTop: -12,
  },
  localBadgeText: { fontSize: 12, fontWeight: '600', color: colors.goldLight },

  field: { gap: 10 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fieldError: { fontSize: 12, color: colors.error, marginTop: 2 },

  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },

  // Cash / Tournament mode cards + preset chips
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  modeCardActive: { borderColor: colors.gold, backgroundColor: colors.goldFaint },
  modeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetChipSelected: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.12)' },
  presetChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  presetChipTextSelected: { color: colors.gold },

  // Tournament setup cards
  setupCard: {
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  setupCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: colors.surfaceHigh,
  },
  stepperBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontSize: 13, fontWeight: '700', color: colors.text, minWidth: 56, textAlign: 'center' },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  miniChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  payoutRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payoutRank: { width: 34, fontSize: 16, textAlign: 'center' },
  payoutInputWrap: { flex: 1 },
  payoutInput: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  payoutPct: { fontSize: 15, fontWeight: '700', color: colors.textMuted, width: 18 },
  sumPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  sumPillOk: {},
  sumPillWarn: {},
  sumText: { fontSize: 12.5, fontWeight: '600' },

  disclosureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  disclosureText: { fontSize: 13, fontWeight: '600', color: colors.gold },
  levelEditor: { gap: 6 },
  levelHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hLv: { width: 22, fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
  hCell: { flex: 1, fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
  hRemove: { width: 24 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  levelNum: { width: 22, fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  levelCell: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  levelRemove: { width: 24, alignItems: 'center', justifyContent: 'center' },
  addLevelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 2 },
  addLevelText: { fontSize: 13, fontWeight: '700', color: colors.gold },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  toggleBlurb: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    backgroundColor: 'rgba(201,168,76,0.10)',
  },
  playerChipText: { fontSize: 13, fontWeight: '600', color: colors.gold },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionButton: { marginTop: 8 },
  stepBackBtn: { flex: 1 },
  nextBtn: { flex: 2 },

  reviewCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    ...shadows.goldSm,
  },
  reviewAccent: {
    width: 4,
    backgroundColor: colors.gold,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  reviewCardBody: {
    flex: 1,
    padding: 20,
    gap: 6,
  },
  reviewName: { ...typography.h2, color: colors.text },
  reviewMeta: { fontSize: 14, color: colors.textMuted },
  reviewPlayerCount: { fontSize: 13, color: colors.goldLight, fontWeight: '600' },
  reviewMetaRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  reviewChip: {
    fontSize: 13,
    color: colors.gold,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
  },
  reviewPlayerChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  reviewPlayerName: { fontSize: 13, fontWeight: '600', color: colors.text },
});
