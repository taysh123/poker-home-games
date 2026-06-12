import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { RootStackParamList } from '../navigation/AppNavigator';
import ActionSheet from '../components/ActionSheet';
import AppTextInput from '../components/AppTextInput';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { useLocalGames } from '../context/LocalGamesContext';
import { computeBalances } from '../local/settlements';
import type { LocalPlayer } from '../local/types';
import { formatCents, formatCentsSigned, parseAmountToCents } from '../utils/money';
import { timeAgo } from '../utils/formatters';
import { lightTap, successNotification } from '../utils/haptics';
import { showToast } from '../utils/toast';
import { confirmDialog, infoDialog } from '../utils/confirm';
import { blindClock } from '../local/blinds';
import { prizePoolCents, remainingPlayerIds } from '../local/tournament';
import Screen from '../components/Screen';
import AnimatedNumber from '../components/motion/AnimatedNumber';
import Avatar from '../components/Avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'LocalSession'>;

type AmountModalState =
  | { kind: 'buyin' | 'cashout'; player: LocalPlayer }
  | { kind: 'addPlayer' }
  | null;

/** Live local (on-device) game — buy-ins, cash-outs, standings, end flow. */
export default function LocalSessionScreen({ route, navigation }: Props) {
  const { gameId } = route.params;
  const insets = useSafeAreaInsets();
  const { games, addBuyIn, addCashOut, addPlayer, undoLastTxn, endGame, eliminatePlayer, undoElimination, deleteGame } =
    useLocalGames();

  const game = games.find(g => g.id === gameId);
  const isTournament = game?.mode === 'tournament';

  // 1-second tick drives the blind countdown (tournaments only).
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    if (!isTournament || game?.status !== 'Active') return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isTournament, game?.status]);

  const [sheetPlayer, setSheetPlayer] = useState<LocalPlayer | null>(null);
  const [amountModal, setAmountModal] = useState<AmountModalState>(null);
  const [amountInput, setAmountInput] = useState('');
  const [amountError, setAmountError] = useState('');

  const [ending, setEnding] = useState(false);
  const [finalStacks, setFinalStacks] = useState<Record<string, string>>({});
  // Explicit arming required to end with an unbalanced count (replaces the old confirm dialog).
  const [overrideArmed, setOverrideArmed] = useState(false);

  const standings = useMemo(() => {
    if (!game) return [];
    const balances = computeBalances(game);
    return game.players
      .map(player => {
        const buyInCents = game.txns
          .filter(t => t.playerId === player.id && t.kind === 'buyin')
          .reduce((s, t) => s + t.amountCents, 0);
        const cashOutCents = game.txns
          .filter(t => t.playerId === player.id && t.kind === 'cashout')
          .reduce((s, t) => s + t.amountCents, 0);
        const netCents = balances.find(b => b.playerId === player.id)?.netCents ?? 0;
        return { player, buyInCents, cashOutCents, netCents };
      })
      .sort((a, b) => b.netCents - a.netCents);
  }, [game]);

  const totalPotCents = useMemo(
    () => game?.txns.filter(t => t.kind === 'buyin').reduce((s, t) => s + t.amountCents, 0) ?? 0,
    [game],
  );

  // Safety: if someone lands here after the game finished, forward to summary.
  useEffect(() => {
    if (game?.status === 'Finished') {
      navigation.replace('LocalSessionSummary', { gameId });
    }
  }, [game?.status, gameId, navigation]);

  // Balance math for The Final Count (plain derivations — safe above the returns).
  const stacksTotalCents = Object.values(finalStacks).reduce((sum, v) => {
    const cents = parseAmountToCents(v);
    return sum + (cents ?? 0);
  }, 0);
  const remainingCents = totalPotCents - standings.reduce((s, p) => s + p.cashOutCents, 0);
  const stacksMismatch = stacksTotalCents !== remainingCents;
  const mismatchCents = Math.abs(remainingCents - stacksTotalCents);

  // Disarm the override the moment the count balances again.
  // MUST stay above the early returns (hooks order).
  useEffect(() => {
    if (!stacksMismatch && overrideArmed) setOverrideArmed(false);
  }, [stacksMismatch, overrideArmed]);

  if (!game) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <EmptyState
          ionicon="alert-circle-outline"
          title="Game not found"
          subtitle="This local game may have been deleted."
          action={{ label: 'Go Back', onPress: () => navigation.goBack() }}
        />
      </View>
    );
  }

  if (game.status === 'Finished') return null;

  function openAmountModal(state: NonNullable<AmountModalState>, presetCents?: number) {
    setAmountInput(presetCents ? String(presetCents / 100) : '');
    setAmountError('');
    setAmountModal(state);
  }

  async function submitAmountModal() {
    if (!amountModal || !game) return;
    if (amountModal.kind === 'addPlayer') {
      const name = amountInput.trim();
      if (!name) { setAmountError('Name is required.'); return; }
      if (game.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        setAmountError('That name is already at the table.');
        return;
      }
      await addPlayer(game.id, name);
      lightTap();
      showToast(`${name} joined the table`, 'success');
      setAmountModal(null);
      return;
    }

    const cents = parseAmountToCents(amountInput);
    if (cents === null) { setAmountError('Enter a valid amount.'); return; }
    if (amountModal.kind === 'buyin') {
      await addBuyIn(game.id, amountModal.player.id, cents);
      showToast(`${amountModal.player.name} bought in for ${formatCents(cents)}`, 'success');
    } else {
      await addCashOut(game.id, amountModal.player.id, cents);
      showToast(`${amountModal.player.name} cashed out ${formatCents(cents)}`, 'success');
    }
    lightTap();
    setAmountModal(null);
  }

  async function handleUndo() {
    // Tournaments: the most recent meaningful action is usually a bust.
    const eliminations = game!.tournament?.eliminations ?? [];
    if (isTournament && eliminations.length > 0) {
      const last = eliminations[eliminations.length - 1];
      const playerName = game!.players.find(p => p.id === last.playerId)?.name ?? 'player';
      await undoElimination(game!.id);
      showToast(`Undid bust-out for ${playerName}`, 'info');
      return;
    }
    if (game!.txns.length === 0) return;
    const last = game!.txns[game!.txns.length - 1];
    const playerName = game!.players.find(p => p.id === last.playerId)?.name ?? 'player';
    await undoLastTxn(game!.id);
    showToast(`Undid ${last.kind === 'buyin' ? 'buy-in' : 'cash-out'} for ${playerName}`, 'info');
  }

  async function handleBustOut(player: LocalPlayer) {
    const remaining = remainingPlayerIds(game!);
    const isFinalBust = remaining.length === 2; // busting now crowns a winner
    const doBust = async () => {
      await eliminatePlayer(game!.id, player.id);
      successNotification();
      // Auto-finish navigates via the Finished-status effect.
      if (!isFinalBust) showToast(`${player.name} busted out`, 'info');
    };
    if (isFinalBust) {
      const winner = game!.players.find(p => p.id === remaining.find(id => id !== player.id));
      confirmDialog(
        'Crown the champion?',
        `Busting ${player.name} ends the tournament — ${winner?.name ?? 'the last player'} wins.`,
        'End Tournament',
        doBust,
      );
    } else {
      await doBust();
    }
  }

  function handleAbortTournament() {
    confirmDialog(
      'Abort tournament?',
      'This deletes the tournament from your device — entries and busts are discarded. This cannot be undone.',
      'Abort & Delete',
      async () => {
        await deleteGame(game!.id);
        navigation.popToTop();
      },
      { destructive: true },
    );
  }

  function openEndFlow() {
    const stacks: Record<string, string> = {};
    for (const p of game!.players) stacks[p.id] = '';
    setFinalStacks(stacks);
    setOverrideArmed(false);
    setEnding(true);
  }

  async function confirmEndGame() {
    if (stacksMismatch && !overrideArmed) return; // button is disabled; defensive
    const stacks: { playerId: string; amountCents: number }[] = [];
    for (const [playerId, value] of Object.entries(finalStacks)) {
      if (!value.trim()) continue;
      const cents = parseAmountToCents(value);
      if (cents === null) {
        infoDialog('Invalid stack', 'Final stacks must be valid amounts (or empty for busted players).');
        return;
      }
      stacks.push({ playerId, amountCents: cents });
    }

    await endGame(game!.id, stacks);
    successNotification();
    navigation.replace('LocalSessionSummary', { gameId: game!.id });
  }

  const defaultBuyInCents = game.defaultBuyInCents;

  return (
    <Screen>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{game.name}</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE · started {timeAgo(game.createdAt)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={handleUndo} hitSlop={12} activeOpacity={0.75} disabled={game.txns.length === 0}>
          <Ionicons name="arrow-undo-outline" size={18} color={game.txns.length === 0 ? colors.textDim : colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Pot summary */}
        <View style={styles.potCard}>
          <Text style={styles.potLabel}>{isTournament ? 'PRIZE POOL' : 'TOTAL POT'}</Text>
          <AnimatedNumber
            value={isTournament ? prizePoolCents(game) : totalPotCents}
            format={formatCents}
            style={styles.potValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.3}
          />
          <Text style={styles.potMeta}>
            {game.players.length} players · {game.txns.filter(t => t.kind === 'buyin').length} buy-ins
          </Text>
        </View>

        {/* Blind clock (tournaments) */}
        {isTournament && game.tournament && (() => {
          const clock = blindClock(game.tournament.blindPreset, game.createdAt, nowMs);
          const mins = Math.floor(clock.secondsRemaining / 60);
          const secs = clock.secondsRemaining % 60;
          return (
            <View style={styles.blindBanner}>
              <View style={styles.blindLevelWrap}>
                <Text style={styles.blindLevelLabel}>LEVEL {clock.current.level}</Text>
                <Text style={styles.blindValue}>
                  {clock.current.smallBlind.toLocaleString()} / {clock.current.bigBlind.toLocaleString()}
                </Text>
              </View>
              <View style={styles.blindClockWrap}>
                <Text style={styles.blindCountdown}>
                  {mins}:{String(secs).padStart(2, '0')}
                </Text>
                <Text style={styles.blindNext}>
                  next {clock.next.smallBlind.toLocaleString()}/{clock.next.bigBlind.toLocaleString()}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Standings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isTournament ? 'IN THE GAME' : 'AT THE TABLE'}</Text>
          {!isTournament && (
            <TouchableOpacity onPress={() => openAmountModal({ kind: 'addPlayer' })} hitSlop={8}>
              <Text style={styles.sectionAction}>+ Add Player</Text>
            </TouchableOpacity>
          )}
        </View>

        {(() => {
          const bustedPositions = new Map(
            (game.tournament?.eliminations ?? []).map(e => [e.playerId, e.position]),
          );
          const visible = isTournament
            ? standings.filter(s => !bustedPositions.has(s.player.id))
            : standings;
          const busted = isTournament
            ? standings
                .filter(s => bustedPositions.has(s.player.id))
                .sort((a, b) => bustedPositions.get(a.player.id)! - bustedPositions.get(b.player.id)!)
            : [];
          return (
            <>
              {visible.map(({ player, buyInCents, cashOutCents, netCents }, index) => {
                const isLeader = !isTournament && index === 0 && netCents > 0;
                return (
                  <TouchableOpacity
                    key={player.id}
                    style={[styles.playerRow, isLeader && styles.playerRowLeader]}
                    onPress={() => setSheetPlayer(player)}
                    activeOpacity={0.75}
                  >
                    <Avatar name={player.name} size={40} />
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName} numberOfLines={1}>
                        {player.name}
                        {isLeader ? '  👑' : ''}
                      </Text>
                      <Text style={styles.playerMeta}>
                        in {formatCents(buyInCents)}{!isTournament && cashOutCents > 0 ? ` · out ${formatCents(cashOutCents)}` : ''}
                      </Text>
                    </View>
                    {!isTournament && (
                      <Text style={[
                        styles.playerNet,
                        netCents > 0 ? styles.netPositive : netCents < 0 ? styles.netNegative : styles.netEven,
                      ]}>
                        {formatCentsSigned(netCents)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}

              {busted.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>BUSTED</Text>
                  </View>
                  {busted.map(({ player, buyInCents }) => (
                    <View key={player.id} style={[styles.playerRow, styles.playerRowBusted]}>
                      <Avatar name={player.name} size={40} />
                      <View style={styles.playerInfo}>
                        <Text style={[styles.playerName, styles.playerNameBusted]} numberOfLines={1}>{player.name}</Text>
                        <Text style={styles.playerMeta}>in {formatCents(buyInCents)}</Text>
                      </View>
                      <View style={styles.positionBadge}>
                        <Text style={styles.positionBadgeText}>#{bustedPositions.get(player.id)}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </>
          );
        })()}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        {isTournament ? (
          <PrimaryButton label="Abort Tournament" onPress={handleAbortTournament} variant="danger" fullWidth={false} style={styles.endBtn} />
        ) : (
          <PrimaryButton label="End Game" onPress={openEndFlow} variant="outline" fullWidth={false} style={styles.endBtn} />
        )}
      </View>

      {/* Player action sheet */}
      <ActionSheet
        visible={sheetPlayer !== null}
        onClose={() => setSheetPlayer(null)}
        title={sheetPlayer?.name}
        subtitle={isTournament ? 'Tournament actions' : 'Record a transaction'}
        options={
          isTournament
            ? [
                ...(defaultBuyInCents
                  ? [{
                      label: `Rebuy ${formatCents(defaultBuyInCents)}`,
                      onPress: () => {
                        const p = sheetPlayer!;
                        addBuyIn(game.id, p.id, defaultBuyInCents).then(() => {
                          lightTap();
                          showToast(`${p.name} rebought for ${formatCents(defaultBuyInCents)}`, 'success');
                        });
                      },
                    }]
                  : []),
                { label: 'Bust Out', onPress: () => handleBustOut(sheetPlayer!), style: 'destructive' as const },
                { label: 'Cancel', onPress: () => {}, style: 'cancel' as const },
              ]
            : [
                ...(defaultBuyInCents
                  ? [{
                      label: `Rebuy ${formatCents(defaultBuyInCents)}`,
                      onPress: () => {
                        const p = sheetPlayer!;
                        addBuyIn(game.id, p.id, defaultBuyInCents).then(() => {
                          lightTap();
                          showToast(`${p.name} bought in for ${formatCents(defaultBuyInCents)}`, 'success');
                        });
                      },
                    }]
                  : []),
                { label: 'Buy In…', onPress: () => openAmountModal({ kind: 'buyin', player: sheetPlayer! }, defaultBuyInCents) },
                { label: 'Cash Out…', onPress: () => openAmountModal({ kind: 'cashout', player: sheetPlayer! }) },
                { label: 'Cancel', onPress: () => {}, style: 'cancel' as const },
              ]
        }
      />

      {/* Amount / add-player modal */}
      <Modal visible={amountModal !== null} transparent animationType="fade" onRequestClose={() => setAmountModal(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {amountModal?.kind === 'addPlayer'
                ? 'Add Player'
                : amountModal?.kind === 'buyin'
                  ? `Buy In — ${amountModal.player.name}`
                  : amountModal?.kind === 'cashout'
                    ? `Cash Out — ${amountModal.player.name}`
                    : ''}
            </Text>
            <AppTextInput
              label={amountModal?.kind === 'addPlayer' ? 'Player Name' : 'Amount'}
              value={amountInput}
              onChangeText={setAmountInput}
              placeholder={amountModal?.kind === 'addPlayer' ? 'Player name...' : '0'}
              keyboardType={amountModal?.kind === 'addPlayer' ? 'default' : 'decimal-pad'}
              prefix={amountModal?.kind === 'addPlayer' ? undefined : '₪'}
              error={amountError}
              autoFocus
            />
            <View style={styles.modalActions}>
              <PrimaryButton label="Cancel" onPress={() => setAmountModal(null)} variant="outline" fullWidth={false} style={styles.modalBtn} />
              <PrimaryButton
                label={amountModal?.kind === 'addPlayer' ? 'Add' : 'Confirm'}
                onPress={submitAmountModal}
                fullWidth={false}
                style={styles.modalBtnPrimary}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* The Final Count — last step before the game closes */}
      <Modal visible={ending} transparent animationType="fade" onRequestClose={() => setEnding(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, styles.endModalCard]}>
            <View style={styles.finalCountHeader}>
              <View style={styles.finalCountIcon}>
                <Ionicons name="flag-outline" size={17} color={colors.gold} />
              </View>
              <Text style={styles.finalCountTitle} maxFontSizeMultiplier={1.3}>The Final Count</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Last step — count each player's remaining chips. We'll settle the rest.
            </Text>

            <ScrollView
              style={[styles.stacksScroll, { maxHeight: Math.min(280, Dimensions.get('window').height * 0.25) }]}
              keyboardShouldPersistTaps="handled"
            >
              {game.players.map(p => {
                const isEmpty = !(finalStacks[p.id] ?? '').trim();
                return (
                  <View key={p.id} style={styles.stackRow}>
                    <View style={styles.stackNameWrap}>
                      <Text style={styles.stackName} numberOfLines={1}>{p.name}</Text>
                      {isEmpty && <Text style={styles.bustedHint}>Busted · ₪0</Text>}
                    </View>
                    <View style={styles.stackInputWrap}>
                      <AppTextInput
                        label=""
                        value={finalStacks[p.id] ?? ''}
                        onChangeText={v => setFinalStacks(prev => ({ ...prev, [p.id]: v }))}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        prefix="₪"
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Balance indicator */}
            <View style={[styles.countCard, stacksMismatch ? styles.countCardWarn : styles.countCardOk]}>
              <Text style={[styles.countHeadline, stacksMismatch && styles.countHeadlineWarn]}>
                Counted {formatCents(stacksTotalCents)} of {formatCents(remainingCents)} on the table
              </Text>
              {stacksMismatch ? (
                <>
                  <Text style={styles.countDetailWarn}>
                    {stacksTotalCents < remainingCents
                      ? `${formatCents(mismatchCents)} unaccounted for`
                      : `${formatCents(mismatchCents)} over the table total`}
                  </Text>
                  <Text style={styles.countWhy}>
                    Chips counted should equal buy-ins minus cash-outs — recount or check for a missed transaction.
                  </Text>
                </>
              ) : (
                <View style={styles.countOkRow}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                  <Text style={styles.countOkText}>Totals match — every shekel is accounted for.</Text>
                </View>
              )}
            </View>

            {/* Inline override — replaces the old post-hoc confirm dialog */}
            {stacksMismatch && (
              <TouchableOpacity
                style={[styles.overrideRow, overrideArmed && styles.overrideRowArmed]}
                onPress={() => setOverrideArmed(v => !v)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={overrideArmed ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={overrideArmed ? colors.error : colors.textMuted}
                />
                <View style={styles.overrideTextWrap}>
                  <Text style={styles.overrideLabel}>End anyway with an unbalanced count</Text>
                  <Text style={styles.overrideCaption}>Results will be off by {formatCents(mismatchCents)}.</Text>
                </View>
              </TouchableOpacity>
            )}

            <Text style={styles.finalityFooter}>
              Winners, losers, and who-pays-who are calculated automatically. This ends the game — it can't be reopened.
            </Text>

            <View style={styles.modalActions}>
              <PrimaryButton label="Keep Playing" onPress={() => setEnding(false)} variant="outline" fullWidth={false} style={styles.modalBtn} />
              <PrimaryButton
                label="End Game & Settle"
                onPress={confirmEndGame}
                variant={overrideArmed ? 'danger' : 'gradient'}
                disabled={stacksMismatch && !overrideArmed}
                fullWidth={false}
                style={styles.modalBtnPrimary}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 3 },
  headerTitle: { ...typography.h3, color: colors.text },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gold },
  liveText: { fontSize: 11, fontWeight: '700', color: colors.goldLight, letterSpacing: 0.5 },

  scroll: { flex: 1 },
  content: { padding: 20, gap: 12 },

  potCard: {
    alignItems: 'center',
    paddingVertical: 22,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    gap: 4,
    marginBottom: 8,
  },
  potLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.2 },

  // Tournament blind clock
  blindBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    marginBottom: 8,
  },
  blindLevelWrap: { gap: 2 },
  blindLevelLabel: { fontSize: 10, fontWeight: '800', color: colors.goldLight, letterSpacing: 1.4 },
  blindValue: { ...typography.amount, color: colors.text, fontVariant: ['tabular-nums'] },
  blindClockWrap: { alignItems: 'flex-end', gap: 2 },
  blindCountdown: { ...typography.amount, color: colors.gold, fontVariant: ['tabular-nums'] },
  blindNext: { fontSize: 11, color: colors.textMuted },

  // Tournament busted rows
  playerRowBusted: { opacity: 0.55 },
  playerNameBusted: { textDecorationLine: 'line-through' },
  positionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  positionBadgeText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  potValue: { ...typography.amountHero, fontSize: 38, color: colors.goldLight },
  potMeta: { fontSize: 13, color: colors.textMuted },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  sectionAction: { fontSize: 13, fontWeight: '700', color: colors.gold },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  playerRowLeader: { borderColor: colors.goldMuted, backgroundColor: colors.goldFaint },
  playerInfo: { flex: 1, gap: 2 },
  playerName: { fontSize: 16, fontWeight: '600', color: colors.text },
  playerMeta: { fontSize: 12, color: colors.textMuted },
  playerNet: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  netPositive: { color: colors.success },
  netNegative: { color: colors.error },
  netEven: { color: colors.textMuted },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  endBtn: { alignSelf: 'stretch' },

  modalOverlay: {
    flex: 1,
    backgroundColor: colors.bgOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 14,
  },
  endModalCard: { maxHeight: '94%' },
  modalTitle: { ...typography.h3, color: colors.text },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1 },
  modalBtnPrimary: { flex: 2 },

  stacksScroll: { maxHeight: 280 },
  stackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  stackNameWrap: { flex: 1, gap: 2 },
  stackName: { fontSize: 15, fontWeight: '600', color: colors.text },
  bustedHint: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  stackInputWrap: { width: 140 },

  // The Final Count
  finalCountHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  finalCountIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalCountTitle: { ...typography.displaySerif, fontSize: 26, color: colors.text },

  countCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  countCardOk: { backgroundColor: 'rgba(39,174,96,0.08)', borderColor: 'rgba(39,174,96,0.35)' },
  countCardWarn: { backgroundColor: colors.errorFaint, borderColor: colors.errorMuted },
  countHeadline: { fontSize: 14, fontWeight: '700', color: colors.text },
  countHeadlineWarn: { color: colors.text },
  countOkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countOkText: { fontSize: 12.5, color: colors.success, fontWeight: '600', flex: 1 },
  countDetailWarn: { fontSize: 13, fontWeight: '700', color: colors.error },
  countWhy: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },

  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  overrideRowArmed: { borderColor: colors.errorMuted, backgroundColor: colors.errorFaint },
  overrideTextWrap: { flex: 1, gap: 2 },
  overrideLabel: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  overrideCaption: { fontSize: 12, color: colors.textMuted },

  finalityFooter: { fontSize: 12, color: colors.textMuted, lineHeight: 17, textAlign: 'center' },
});
