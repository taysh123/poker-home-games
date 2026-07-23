import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
  Dimensions,
  useWindowDimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/AppNavigator';
import ActionSheet from '../components/ActionSheet';
import AppTextInput from '../components/AppTextInput';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { useLocalGames } from '../context/LocalGamesContext';
import { computeBalances } from '../local/settlements';
import type { LocalPlayer } from '../local/types';
import { formatCents, formatCentsSigned, parseAmountToCents } from '../utils/money';
import { currencySymbol } from '../utils/currency';
import { timeAgo } from '../utils/formatters';
import { lightTap, mediumTap, successNotification } from '../utils/haptics';
import { showToast } from '../utils/toast';
import { confirmDialog, infoDialog } from '../utils/confirm';
import { clockView } from '../local/blinds';
import { prizePoolCents, remainingPlayerIds, payoutAmountsCents } from '../local/tournament';
import { isLateRegOpen } from '../local/localGamesStore';
import Screen from '../components/Screen';
import Chip from '../components/Chip';
import AnimatedNumber from '../components/motion/AnimatedNumber';
import { PressableScale, MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import Avatar from '../components/Avatar';
import ContentContainer from '../components/ContentContainer';
import TableScene from '../components/table/TableScene';
import type { SeatProps } from '../components/table/TableSeat';
import { tableDimensions } from '../utils/tableLayout';
import { nameWritingDirection } from '../utils/rtl';
import { isFeatureEnabled } from '../config/features';

type Props = NativeStackScreenProps<RootStackParamList, 'LocalSession'>;

type AmountModalState =
  | { kind: 'buyin' | 'cashout'; player: LocalPlayer }
  | { kind: 'addPlayer' }
  | null;

/**
 * Spread-ready entrance props for MotiView. The DS motion recipe's transition
 * union is looser than MotiView's discriminated transition prop, so we cast at
 * the boundary (type-only — identical runtime) and keep the DS recipes untouched.
 */
const entrance = (opts?: Parameters<typeof slideUpSequence>[0]) =>
  slideUpSequence(opts) as unknown as React.ComponentProps<typeof MotiView>;

/** Live local (on-device) game — buy-ins, cash-outs, standings, end flow. */
export default function LocalSessionScreen({ route, navigation }: Props) {
  const { gameId } = route.params;
  const insets = useSafeAreaInsets();
  const sym = currencySymbol();
  const { games, addBuyIn, addCashOut, addPlayer, undoLastTxn, endGame, eliminatePlayer, undoElimination, deleteGame, syncClock, pauseClock, resumeClock, gotoLevel, finishTournamentEarly } =
    useLocalGames();

  const game = games.find(g => g.id === gameId);
  const isTournament = game?.mode === 'tournament';
  const reduced = useReducedMotion();
  // Entrances are suppressed while the tournament clock is actively ticking (1s
  // re-renders) so the live dashboard never re-animates — cash games still get them.
  const liveReduced = reduced || isTournament;
  // Immersive cash table (felt + seats) is the beta/dev presentation of the live cash screen; prod keeps
  // the proven flat list until `immersive` is flipped on. Tournaments keep the dashboard + list.
  const immersive = isFeatureEnabled('immersive');
  const { width: winW } = useWindowDimensions();
  const { width: TABLE_W, height: TABLE_H } = tableDimensions(winW - 40);

  // 1-second tick drives the blind countdown (tournaments only) and auto-advances
  // the stored clock when a running level expires.
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    if (!isTournament || game?.status !== 'Active') return;
    const interval = setInterval(() => {
      const t = Date.now();
      setNowMs(t);
      syncClock(gameId, t);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTournament, game?.status, gameId, syncClock]);

  const [sheetPlayer, setSheetPlayer] = useState<LocalPlayer | null>(null);
  const [amountModal, setAmountModal] = useState<AmountModalState>(null);
  const [amountInput, setAmountInput] = useState('');
  const [amountError, setAmountError] = useState('');

  const [ending, setEnding] = useState(false);
  const [finalStacks, setFinalStacks] = useState<Record<string, string>>({});
  // Explicit arming required to end with an unbalanced count (replaces the old confirm dialog).
  const [overrideArmed, setOverrideArmed] = useState(false);

  // Tournament end controls
  const [endSheet, setEndSheet] = useState(false);
  const [rankOrder, setRankOrder] = useState<string[] | null>(null);

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

  // Immersive cash table: one tappable seat per player (name + buy-in); tapping opens the action sheet.
  const liveSeats: SeatProps[] = standings.map(({ player, buyInCents }) => ({
    name: player.name,
    sub: formatCents(buyInCents),
    onPress: () => setSheetPlayer(player),
  }));

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
      <Screen style={{ paddingTop: insets.top }}>
        <EmptyState
          ionicon="alert-circle-outline"
          title="Game not found"
          subtitle="This local game may have been deleted."
          action={{ label: 'Go Back', onPress: () => navigation.goBack() }}
        />
      </Screen>
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
    successNotification();
    setAmountModal(null);
  }

  async function handleUndo() {
    // Tournaments: the most recent meaningful action is usually a bust.
    const eliminations = game!.tournament?.eliminations ?? [];
    if (isTournament && eliminations.length > 0) {
      const last = eliminations[eliminations.length - 1];
      const playerName = game!.players.find(p => p.id === last.playerId)?.name ?? 'player';
      await undoElimination(game!.id);
      lightTap();
      showToast(`Undid bust-out for ${playerName}`, 'info');
      return;
    }
    if (game!.txns.length === 0) return;
    const last = game!.txns[game!.txns.length - 1];
    const playerName = game!.players.find(p => p.id === last.playerId)?.name ?? 'player';
    await undoLastTxn(game!.id);
    lightTap();
    showToast(`Undid ${last.kind === 'buyin' ? 'buy-in' : 'cash-out'} for ${playerName}`, 'info');
  }

  async function handleBustOut(player: LocalPlayer) {
    const remaining = remainingPlayerIds(game!);
    const isFinalBust = remaining.length === 2; // busting now crowns a winner
    const doBust = async () => {
      await eliminatePlayer(game!.id, player.id);
      mediumTap();
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

  function openFinishEarly() {
    setRankOrder(remainingPlayerIds(game!));
  }

  function moveRank(index: number, dir: -1 | 1) {
    setRankOrder(prev => {
      if (!prev) return prev;
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function confirmFinishEarly() {
    if (!rankOrder) return;
    await finishTournamentEarly(game!.id, rankOrder);
    successNotification();
    setRankOrder(null);
    navigation.replace('LocalSessionSummary', { gameId: game!.id });
  }

  async function toggleClockPause() {
    const t = game!.tournament!;
    lightTap();
    if (t.clock.status === 'running') await pauseClock(game!.id);
    else await resumeClock(game!.id);
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
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12} haptic="light" accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={iconSize.sm} color={colors.text} />
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{game.name}</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE · started {timeAgo(game.createdAt)}</Text>
          </View>
        </View>
        <PressableScale style={styles.backBtn} onPress={handleUndo} hitSlop={12} haptic="light" disabled={game.txns.length === 0} accessibilityRole="button" accessibilityLabel="Undo last action" accessibilityState={{ disabled: game.txns.length === 0 }}>
          <Ionicons name="arrow-undo-outline" size={iconSize.sm} color={game.txns.length === 0 ? colors.textDim : colors.text} />
        </PressableScale>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ContentContainer style={styles.contentInner}>
        {/* Pot summary */}
        <MotiView {...entrance({ reduced: liveReduced })} style={styles.potCard}>
          <LinearGradient
            colors={[colors.goldFaint, 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.potGlow}
            pointerEvents="none"
          />
          <Text style={styles.potLabel}>TOTAL BUY-INS</Text>
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
        </MotiView>

        {/* Tournament dashboard: blind clock + controls + live stats */}
        {isTournament && game.tournament && (() => {
          const t = game.tournament;
          const view = clockView(t.clock, t.blindLevels, nowMs);
          const mins = Math.floor(view.secondsRemaining / 60);
          const secs = view.secondsRemaining % 60;
          const playersLeft = remainingPlayerIds(game).length;
          const buyinCount = game.txns.filter(tx => tx.kind === 'buyin').length;
          const pool = prizePoolCents(game);
          const payouts = payoutAmountsCents(pool, t.payouts);
          // The next player to bust finishes here; show their payout (or "bubble").
          const nextOutPosition = playersLeft;
          const nextOutPayout = nextOutPosition >= 1 && nextOutPosition <= payouts.length
            ? payouts[nextOutPosition - 1] : 0;
          const chipsInPlay = t.startingStackChips ? t.startingStackChips * buyinCount : 0;
          const avgStack = chipsInPlay && playersLeft ? Math.round(chipsInPlay / playersLeft) : 0;
          const bbLeft = avgStack && view.current.bigBlind ? Math.round(avgStack / view.current.bigBlind) : 0;
          const atLastLevel = view.levelNumber >= t.blindLevels.length;

          return (
            <View style={styles.dashCard}>
              {/* Clock */}
              <View style={styles.dashClockRow}>
                <View style={styles.dashLevelWrap}>
                  <Text style={styles.dashLevelLabel}>LEVEL {view.levelNumber}{view.paused ? ' · PAUSED' : ''}</Text>
                  <Text style={styles.dashBlinds}>
                    {view.current.isBreak ? 'BREAK' : `${view.current.smallBlind.toLocaleString()} / ${view.current.bigBlind.toLocaleString()}`}
                    {view.current.ante ? ` · ante ${view.current.ante.toLocaleString()}` : ''}
                  </Text>
                  {view.next && (
                    <Text style={styles.dashNext}>
                      next {view.next.smallBlind.toLocaleString()}/{view.next.bigBlind.toLocaleString()}
                    </Text>
                  )}
                </View>
                <Text style={[styles.dashCountdown, view.paused && styles.dashCountdownPaused]}>
                  {mins}:{String(secs).padStart(2, '0')}
                </Text>
              </View>

              {/* Clock controls */}
              <View style={styles.dashControls}>
                <PressableScale
                  style={styles.dashCtrlBtn}
                  onPress={() => { lightTap(); gotoLevel(game.id, -1); }}
                  disabled={view.levelNumber <= 1}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Previous blind level"
                  accessibilityState={{ disabled: view.levelNumber <= 1 }}
                >
                  <Ionicons name="play-skip-back" size={iconSize.xs} color={view.levelNumber <= 1 ? colors.textDim : colors.text} />
                </PressableScale>
                <PressableScale style={[styles.dashCtrlBtn, styles.dashCtrlPrimary]} onPress={toggleClockPause} hitSlop={8} accessibilityRole="button" accessibilityLabel={view.paused ? 'Resume the clock' : 'Pause the clock'}>
                  <Ionicons name={view.paused ? 'play' : 'pause'} size={iconSize.sm} color={colors.background} />
                  <Text style={styles.dashCtrlPrimaryText}>{view.paused ? 'Resume' : 'Pause'}</Text>
                </PressableScale>
                <PressableScale
                  style={styles.dashCtrlBtn}
                  onPress={() => { lightTap(); gotoLevel(game.id, 1); }}
                  disabled={atLastLevel}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Next blind level"
                  accessibilityState={{ disabled: atLastLevel }}
                >
                  <Ionicons name="play-skip-forward" size={iconSize.xs} color={atLastLevel ? colors.textDim : colors.text} />
                </PressableScale>
              </View>

              {/* Live stats */}
              <View style={styles.dashStats}>
                <View style={styles.dashStat}>
                  <Text style={styles.dashStatValue}>{playersLeft}<Text style={styles.dashStatSub}>/{game.players.length}</Text></Text>
                  <Text style={styles.dashStatLabel}>LEFT</Text>
                </View>
                <View style={styles.dashStatDivider} />
                <View style={styles.dashStat}>
                  <Text style={styles.dashStatValue}>{avgStack ? avgStack.toLocaleString() : '—'}</Text>
                  <Text style={styles.dashStatLabel}>{bbLeft ? `AVG · ${bbLeft} BB` : 'AVG STACK'}</Text>
                </View>
                <View style={styles.dashStatDivider} />
                <View style={styles.dashStat}>
                  <Text style={styles.dashStatValue}>{nextOutPayout > 0 ? formatCents(nextOutPayout) : 'Bubble'}</Text>
                  <Text style={styles.dashStatLabel}>NEXT OUT · {nextOutPosition}{nextOutPosition === 1 ? 'ST' : nextOutPosition === 2 ? 'ND' : nextOutPosition === 3 ? 'RD' : 'TH'}</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Standings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isTournament ? 'IN THE GAME' : 'AT THE TABLE'}</Text>
          {(!isTournament || isLateRegOpen(game)) && (
            <PressableScale
              onPress={() => openAmountModal({ kind: 'addPlayer' })}
              hitSlop={8}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={isTournament ? 'Register a late entry' : 'Add a player'}
            >
              <Text style={styles.sectionAction}>+ {isTournament ? 'Late Reg' : 'Add Player'}</Text>
            </PressableScale>
          )}
        </View>

        {(!isTournament && immersive) ? (
          <View style={styles.tableSceneWrapper}>
            <TableScene
              players={liveSeats}
              width={TABLE_W}
              height={TABLE_H}
              potCents={totalPotCents}
              style={styles.tableScene}
            />
          </View>
        ) : (() => {
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
                  <MotiView key={player.id} {...entrance({ reduced: liveReduced, delay: staggerIn(index) })}>
                    <PressableScale
                      style={[styles.playerRow, isLeader && styles.playerRowLeader]}
                      onPress={() => setSheetPlayer(player)}
                      haptic="light"
                      accessibilityRole="button"
                      accessibilityLabel={`${player.name}. Tap for actions.`}
                    >
                      <Avatar name={player.name} size={40} />
                      <View style={styles.playerInfo}>
                        <View style={styles.playerNameRow}>
                          <Text style={[styles.playerName, { writingDirection: nameWritingDirection(player.name) }]} numberOfLines={1}>{player.name}</Text>
                          {isLeader && (
                            <Ionicons name="trophy" size={iconSize.xs} color={colors.goldLight} style={styles.leaderCrown} accessibilityLabel="Chip leader" />
                          )}
                        </View>
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
                    </PressableScale>
                  </MotiView>
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
                        <Text style={[styles.playerName, styles.playerNameBusted, { writingDirection: nameWritingDirection(player.name) }]} numberOfLines={1}>{player.name}</Text>
                        <Text style={styles.playerMeta}>in {formatCents(buyInCents)}</Text>
                      </View>
                      <Chip label={`#${bustedPositions.get(player.id)}`} tone="neutral" size="md" style={{ alignSelf: 'center' }} />
                    </View>
                  ))}
                </>
              )}
            </>
          );
        })()}

        <View style={{ height: 120 }} />
        </ContentContainer>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        {isTournament ? (
          <PrimaryButton label="End Tournament" onPress={() => setEndSheet(true)} variant="outline" fullWidth={false} style={styles.endBtn} />
        ) : (
          <PrimaryButton label="End Game" onPress={openEndFlow} variant="outline" fullWidth={false} style={styles.endBtn} />
        )}
      </View>

      {/* End Tournament options */}
      <ActionSheet
        visible={endSheet}
        onClose={() => setEndSheet(false)}
        title="End Tournament"
        subtitle="Finish and settle, or discard"
        options={[
          {
            label: 'Finish early — rank players',
            onPress: () => { setEndSheet(false); openFinishEarly(); },
          },
          {
            label: 'Abort & delete',
            onPress: () => { setEndSheet(false); handleAbortTournament(); },
            style: 'destructive' as const,
          },
          { label: 'Cancel', onPress: () => {}, style: 'cancel' as const },
        ]}
      />

      {/* Finish-early ranking modal */}
      <Modal visible={rankOrder !== null} transparent animationType="fade" onRequestClose={() => setRankOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.endModalCard]}>
            <View style={styles.finalCountHeader}>
              <View style={styles.finalCountIcon}>
                <Ionicons name="podium-outline" size={iconSize.xs} color={colors.gold} />
              </View>
              <Text style={styles.finalCountTitle} maxFontSizeMultiplier={1.3}>Final Ranking</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Order the players still in — top finishes first. Prize splits apply by your structure.
            </Text>

            <ScrollView style={{ maxHeight: Math.min(320, Dimensions.get('window').height * 0.4) }}>
              {(rankOrder ?? []).map((pid, i) => {
                const p = game.players.find(pl => pl.id === pid);
                return (
                  <View key={pid} style={styles.rankRow}>
                    <Text style={styles.rankMedal}>{`#${i + 1}`}</Text>
                    <Avatar name={p?.name ?? '?'} size={34} />
                    <Text style={[styles.rankName, { writingDirection: nameWritingDirection(p?.name) }]} numberOfLines={1}>{p?.name}</Text>
                    <View style={styles.rankArrows}>
                      <PressableScale style={styles.rankArrow} onPress={() => moveRank(i, -1)} disabled={i === 0} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Move ${p?.name ?? 'player'} up`} accessibilityState={{ disabled: i === 0 }}>
                        <Ionicons name="chevron-up" size={iconSize.sm} color={i === 0 ? colors.textDim : colors.gold} />
                      </PressableScale>
                      <PressableScale style={styles.rankArrow} onPress={() => moveRank(i, 1)} disabled={i === (rankOrder?.length ?? 0) - 1} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Move ${p?.name ?? 'player'} down`} accessibilityState={{ disabled: i === (rankOrder?.length ?? 0) - 1 }}>
                        <Ionicons name="chevron-down" size={iconSize.sm} color={i === (rankOrder?.length ?? 0) - 1 ? colors.textDim : colors.gold} />
                      </PressableScale>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <Text style={styles.finalityFooter}>
              This ends the tournament and settles the final standings. It can't be reopened.
            </Text>
            <View style={styles.modalActions}>
              <PrimaryButton label="Cancel" onPress={() => setRankOrder(null)} variant="outline" fullWidth={false} style={styles.modalBtn} />
              <PrimaryButton label="Finish & Settle" onPress={confirmFinishEarly} variant="gradient" fullWidth={false} style={styles.modalBtnPrimary} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Player action sheet */}
      <ActionSheet
        visible={sheetPlayer !== null}
        onClose={() => setSheetPlayer(null)}
        title={sheetPlayer?.name}
        subtitle={isTournament ? 'Tournament actions' : 'Record a transaction'}
        options={
          isTournament
            ? [
                ...(game.tournament?.rebuysAllowed && defaultBuyInCents
                  ? [{
                      label: `Rebuy ${formatCents(defaultBuyInCents)}`,
                      onPress: () => {
                        const p = sheetPlayer!;
                        addBuyIn(game.id, p.id, defaultBuyInCents, 'rebuy').then(() => {
                          successNotification();
                          showToast(`${p.name} rebought for ${formatCents(defaultBuyInCents)}`, 'success');
                        });
                      },
                    }]
                  : []),
                ...(game.tournament?.addOnsAllowed && game.tournament?.addOnAmountCents
                  ? [{
                      label: `Add-on ${formatCents(game.tournament.addOnAmountCents)}`,
                      onPress: () => {
                        const p = sheetPlayer!;
                        const amt = game.tournament!.addOnAmountCents!;
                        addBuyIn(game.id, p.id, amt, 'addon').then(() => {
                          successNotification();
                          showToast(`${p.name} added on ${formatCents(amt)}`, 'success');
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
                          successNotification();
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
              prefix={amountModal?.kind === 'addPlayer' ? undefined : sym}
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
                <Ionicons name="flag-outline" size={iconSize.xs} color={colors.gold} />
              </View>
              <Text style={styles.finalCountTitle} maxFontSizeMultiplier={1.3}>The Final Count</Text>
            </View>
            <ScrollView style={styles.endScroll} contentContainerStyle={styles.endScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>
                Last step — count each player's remaining chips. We'll settle the rest.
              </Text>

              <View style={styles.stacksBlock}>
                {game.players.map(p => {
                  const isEmpty = !(finalStacks[p.id] ?? '').trim();
                  return (
                    <View key={p.id} style={styles.stackRow}>
                      <View style={styles.stackNameWrap}>
                        <Text style={[styles.stackName, { writingDirection: nameWritingDirection(p.name) }]} numberOfLines={1}>{p.name}</Text>
                        {isEmpty && <Text style={styles.bustedHint}>Busted · {sym}0</Text>}
                      </View>
                      <View style={styles.stackInputWrap}>
                        <AppTextInput
                          label=""
                          value={finalStacks[p.id] ?? ''}
                          onChangeText={v => setFinalStacks(prev => ({ ...prev, [p.id]: v }))}
                          placeholder="0"
                          keyboardType="decimal-pad"
                          prefix={sym}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>

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
                    <Ionicons name="checkmark-circle" size={iconSize.xs} color={colors.success} />
                    <Text style={styles.countOkText}>Totals match — every shekel is accounted for.</Text>
                  </View>
                )}
              </View>

              {/* Inline override — replaces the old post-hoc confirm dialog */}
              {stacksMismatch && (
                <PressableScale
                  style={[styles.overrideRow, overrideArmed && styles.overrideRowArmed]}
                  onPress={() => setOverrideArmed(v => !v)}
                  haptic="light"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: overrideArmed }}
                  accessibilityLabel="End anyway with an unbalanced count"
                  accessibilityHint={`Results will be off by ${formatCents(mismatchCents)}`}
                >
                  <Ionicons
                    name={overrideArmed ? 'checkbox' : 'square-outline'}
                    size={iconSize.md}
                    color={overrideArmed ? colors.error : colors.textMuted}
                  />
                  <View style={styles.overrideTextWrap}>
                    <Text style={styles.overrideLabel}>End anyway with an unbalanced count</Text>
                    <Text style={styles.overrideCaption}>Results will be off by {formatCents(mismatchCents)}.</Text>
                  </View>
                </PressableScale>
              )}

              <Text style={styles.finalityFooter}>
                Winners, losers, and who-pays-who are calculated automatically. This ends the game — it can't be reopened.
              </Text>
            </ScrollView>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 3 },
  headerTitle: { ...typography.h3, color: colors.text },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gold },
  liveText: { fontSize: 11, fontWeight: '700', color: colors.goldLight, letterSpacing: 0.5 },

  scroll: { flex: 1 },
  content: { padding: spacing.xl },
  contentInner: { gap: spacing.md },
  tableSceneWrapper: { alignSelf: 'center', marginVertical: spacing.xs },
  tableScene: { alignSelf: 'center' },

  potCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    gap: spacing.xs,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  potGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  potLabel: { ...typography.caps, color: colors.goldLight },

  // Tournament dashboard
  dashCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    padding: spacing.lg,
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  dashClockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  dashLevelWrap: { flex: 1, gap: 3 },
  dashLevelLabel: { fontSize: 10, fontWeight: '800', color: colors.goldLight, letterSpacing: 1.4 },
  dashBlinds: { ...typography.amount, color: colors.text, fontVariant: ['tabular-nums'] },
  dashNext: { fontSize: 11, color: colors.textMuted },
  dashCountdown: { ...typography.amountHero, fontSize: 40, color: colors.gold, fontVariant: ['tabular-nums'] },
  dashCountdownPaused: { color: colors.textMuted },

  dashControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dashCtrlBtn: {
    height: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dashCtrlPrimary: { flex: 1, backgroundColor: colors.gold, borderColor: colors.gold },
  dashCtrlPrimaryText: { fontSize: 15, fontWeight: '800', color: colors.background },

  dashStats: { flexDirection: 'row', alignItems: 'center' },
  dashStat: { flex: 1, alignItems: 'center', gap: 3 },
  dashStatValue: { fontSize: 18, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  dashStatSub: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  dashStatLabel: { fontSize: 9.5, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6 },
  dashStatDivider: { width: 1, height: spacing.xxxl, backgroundColor: colors.border },

  // Finish-early ranking
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rankMedal: { width: 30, fontSize: 16, textAlign: 'center', fontWeight: '700', color: colors.textMuted },
  rankName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  rankArrows: { flexDirection: 'row', gap: spacing.xs },
  rankArrow: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tournament busted rows
  playerRowBusted: { opacity: 0.55 },
  playerNameBusted: { textDecorationLine: 'line-through' },
  potValue: { ...typography.amountHero, fontSize: 38, color: colors.goldLight },
  potMeta: { fontSize: 13, color: colors.textMuted },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  sectionAction: { fontSize: 13, fontWeight: '700', color: colors.gold },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  playerRowLeader: { borderColor: colors.goldMuted, backgroundColor: colors.goldFaint },
  playerInfo: { flex: 1, gap: 2 },
  playerName: { fontSize: 16, fontWeight: '600', color: colors.text },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  leaderCrown: { marginTop: 1 },
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
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
    padding: spacing.xxl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  endModalCard: { maxHeight: '94%' },
  modalTitle: { ...typography.h3, color: colors.text },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  modalBtn: { flex: 1 },
  modalBtnPrimary: { flex: 2 },

  endScroll: { flexShrink: 1 },
  endScrollContent: { gap: spacing.lg },
  stacksBlock: { gap: spacing.sm },
  stackRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stackNameWrap: { flex: 1, gap: 2 },
  stackName: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'left' },
  bustedHint: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  stackInputWrap: { width: 140 },

  // The Final Count
  finalCountHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  finalCountIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalCountTitle: { ...typography.displaySerif, fontSize: 26, color: colors.text },

  countCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  countCardOk: { backgroundColor: colors.successFaint, borderColor: colors.success },
  countCardWarn: { backgroundColor: colors.errorFaint, borderColor: colors.errorMuted },
  countHeadline: { fontSize: 14, fontWeight: '700', color: colors.text },
  countHeadlineWarn: { color: colors.text },
  countOkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countOkText: { fontSize: 12.5, color: colors.success, fontWeight: '600', flex: 1 },
  countDetailWarn: { fontSize: 13, fontWeight: '700', color: colors.error },
  countWhy: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },

  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 48,
    borderRadius: radii.md,
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
