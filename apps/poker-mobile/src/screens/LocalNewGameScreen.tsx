import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
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
import ScreenHeader from '../components/ScreenHeader';
import { getRecentGuests, recordGuestName } from '../utils/guestHistory';
import { parseAmountToCents, formatCents } from '../utils/money';
import { useLocalGames } from '../context/LocalGamesContext';
import { showToast } from '../utils/toast';
import { infoDialog } from '../utils/confirm';

type Props = NativeStackScreenProps<RootStackParamList, 'LocalNewGame'>;

/**
 * Local-only New Game wizard — no account, no network. Mirrors the NewGame
 * wizard UX but every player is a named local player stored on-device.
 */
export default function LocalNewGameScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { startGame, activeGame } = useLocalGames();

  const [step, setStep] = useState(1);
  const STEP_LABELS = ['Details', 'Players', 'Review'];
  const reviewAnim = useRef(new Animated.Value(0)).current;
  const [starting, setStarting] = useState(false);

  const defaultName = (() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[new Date().getDay()]} Night`;
  })();
  const [gameName, setGameName] = useState(defaultName);
  const [nameError, setNameError] = useState('');
  const [chipRatio, setChipRatio] = useState('');
  const [defaultBuyIn, setDefaultBuyIn] = useState('');
  const [buyInError, setBuyInError] = useState('');

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
      if (defaultBuyIn.trim() && parseAmountToCents(defaultBuyIn) === null) {
        setBuyInError('Enter a valid amount.');
        return;
      }
      setNameError('');
      setBuyInError('');
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
        chipRatio: ratio && Number.isFinite(ratio) ? ratio : undefined,
        defaultBuyInCents: buyInCents,
      });

      for (const name of playerNames) {
        await recordGuestName(name);
      }

      showToast('Game started!', 'success');
      navigation.replace('LocalSession', { gameId: game.id });
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

            <View style={styles.row}>
              <View style={styles.halfField}>
                <AppTextInput
                  label="Chip Ratio"
                  value={chipRatio}
                  onChangeText={setChipRatio}
                  placeholder="e.g. 100"
                  keyboardType="decimal-pad"
                  hint="chips per ₪"
                />
              </View>
              <View style={styles.halfField}>
                <AppTextInput
                  label="Default Buy-In"
                  value={defaultBuyIn}
                  onChangeText={setDefaultBuyIn}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  prefix="₪"
                  error={buyInError}
                />
              </View>
            </View>

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
                <Text style={styles.reviewMeta}>Local game · this device</Text>
                <Text style={styles.reviewPlayerCount}>
                  {playerNames.length} player{playerNames.length !== 1 ? 's' : ''} at the table
                </Text>
                <View style={styles.reviewMetaRow}>
                  {defaultBuyIn && parseAmountToCents(defaultBuyIn) !== null
                    ? <Text style={styles.reviewChip}>{formatCents(parseAmountToCents(defaultBuyIn)!)} buy-in</Text>
                    : null}
                  {chipRatio ? <Text style={styles.reviewChip}>{chipRatio} chips/₪</Text> : null}
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
