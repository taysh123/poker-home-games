import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Sora } from '../theme/fonts';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import { RootStackParamList } from '../navigation/AppNavigator';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import Screen from '../components/Screen';
import Chip from '../components/Chip';
import { useLocalGames } from '../context/LocalGamesContext';
import { buildGameResults } from '../local/gameResults';
import ShareCard, { canShareImages, shareCardImage, ShareCardData } from '../components/ShareCard';
import CrossPillarCTA from '../components/CrossPillarCTA';
import ContentContainer from '../components/ContentContainer';
import { nameWritingDirection } from '../utils/rtl';
import { isFeatureEnabled } from '../config/features';
import { formatDate } from '../utils/formatters';
import { formatCents, formatCentsSigned } from '../utils/money';
import { formatDuration } from '../utils/formatters';
import { confirmDialog } from '../utils/confirm';
import { useAuth } from '../context/AuthContext';
import { markSignupIntent } from '../utils/analytics';
import AnimatedNumber from '../components/motion/AnimatedNumber';
import Celebration from '../components/motion/Celebration';
import { PressableScale, MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = NativeStackScreenProps<RootStackParamList, 'LocalSessionSummary'>;

/**
 * Spread-ready entrance props for MotiView. The DS motion recipe's transition
 * union is looser than MotiView's discriminated transition prop, so we cast at
 * the boundary (type-only — identical runtime) and keep the DS recipes untouched.
 */
const entrance = (opts?: Parameters<typeof slideUpSequence>[0]) =>
  slideUpSequence(opts) as unknown as React.ComponentProps<typeof MotiView>;

/** Results + cash settlements for a finished local game. */
export default function LocalSessionSummaryScreen({ route, navigation }: Props) {
  const { gameId } = route.params;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { games, deleteGame } = useLocalGames();
  const { user } = useAuth();

  const game = games.find(g => g.id === gameId);
  const isTournament = game?.mode === 'tournament';
  const shareRef = React.useRef<View>(null);

  // Results/settlements are computed by the shared, tested normalizer (local/gameResults.ts) — the
  // same data the branded Results Card 2.0 will read. Rendering below is unchanged.
  const { results, transfers, totalPotCents, podium } = useMemo(
    () => (game ? buildGameResults(game) : { results: [], transfers: [], totalPotCents: 0, podium: null }),
    [game],
  );

  if (!game) {
    return (
      <Screen style={{ paddingTop: insets.top }}>
        <EmptyState
          ionicon="alert-circle-outline"
          title="Game not found"
          subtitle="This local game may have been deleted."
          action={{ label: 'Go Home', onPress: () => navigation.popToTop() }}
        />
      </Screen>
    );
  }

  const playerName = (id: string) => game.players.find(p => p.id === id)?.name ?? 'Unknown';

  // Champion spotlight for the celebration hero (tournament winner or top cash winner).
  let championName: string | null = null;
  let championSub: string | null = null;
  if (podium && podium.length) {
    const top = podium.find(p => p.position === 1);
    if (top) {
      championName = top.player.name;
      championSub = top.payoutCents > 0 ? `wins ${formatCents(top.payoutCents)}` : formatCentsSigned(top.netCents);
    }
  } else if (results.length && results[0].netCents > 0) {
    championName = results[0].player.name;
    championSub = formatCentsSigned(results[0].netCents);
  }

  // Confetti only when arriving fresh from ending the game — not when
  // revisiting an old summary from the games list.
  const justEnded = !!game.endedAt && Date.now() - new Date(game.endedAt).getTime() < 60_000;

  // Shareable image card (native only)
  const shareData: ShareCardData = {
    title: game.name,
    heading: isTournament ? 'TOURNAMENT COMPLETE' : 'GAME OVER',
    potLabel: 'TOTAL BUY-INS',
    potCents: totalPotCents,
    dateText: formatDate(game.endedAt ?? game.createdAt),
    rows: podium
      ? podium.slice(0, 3).map(p => ({
          name: p.player.name,
          valueText: p.payoutCents > 0 ? `wins ${formatCents(p.payoutCents)}` : formatCentsSigned(p.netCents),
          positive: p.netCents >= 0,
          medal: `#${p.position}`,
        }))
      : results.slice(0, 3).map(r => ({
          name: r.player.name,
          valueText: formatCentsSigned(r.netCents),
          positive: r.netCents >= 0,
        })),
  };

  async function handleShareImage() {
    try {
      await shareCardImage(shareRef);
    } catch {
      // share sheet dismissed or capture failed — non-critical
    }
  }

  function handleDelete() {
    confirmDialog(
      'Delete this game?',
      'This removes it from your device. This cannot be undone.',
      'Delete',
      async () => {
        await deleteGame(game!.id);
        navigation.popToTop();
      },
      { destructive: true },
    );
  }

  return (
    <Screen>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <PressableScale style={styles.backBtn} onPress={() => navigation.popToTop()} hitSlop={12} haptic="light" accessibilityRole="button" accessibilityLabel="Close summary">
          <Ionicons name="close" size={iconSize.sm} color={colors.text} />
        </PressableScale>
        <Text style={styles.headerTitle} numberOfLines={1}>{game.name}</Text>
        <View style={styles.headerActions}>
          {canShareImages && (
            <PressableScale style={styles.backBtn} onPress={handleShareImage} hitSlop={12} haptic="light" accessibilityRole="button" accessibilityLabel="Share result card">
              <Ionicons name="share-outline" size={iconSize.sm} color={colors.gold} />
            </PressableScale>
          )}
          <PressableScale style={styles.backBtn} onPress={handleDelete} hitSlop={12} haptic="light" accessibilityRole="button" accessibilityLabel="Delete this game">
            <Ionicons name="trash-outline" size={iconSize.sm} color={colors.textMuted} />
          </PressableScale>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ContentContainer>
        {/* Cash games: a clean player list of who won and lost, up top where the felt used to be. */}
        {!podium && results.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, styles.sectionTitleFirst]}>RESULTS</Text>
            {results.map(({ player, netCents }, index) => {
              const isWinner = index === 0 && netCents > 0;
              return (
                <MotiView
                  key={player.id}
                  {...entrance({ reduced, delay: staggerIn(index) })}
                  style={[styles.resultRow, isWinner && styles.resultRowWinner]}
                >
                  <Text style={[styles.resultRank, isWinner && styles.resultRankWinner]}>
                    {`#${index + 1}`}
                  </Text>
                  <Text style={[styles.resultName, { writingDirection: nameWritingDirection(player.name) }]} numberOfLines={1}>
                    {player.name}
                  </Text>
                  <Text style={[
                    styles.resultNet,
                    netCents > 0 ? styles.netPositive : netCents < 0 ? styles.netNegative : styles.netEven,
                  ]}>
                    {formatCentsSigned(netCents)}
                  </Text>
                </MotiView>
              );
            })}
          </>
        )}
        {/* Game over hero (celebration) */}
        <MotiView {...entrance({ reduced })} style={styles.heroCard}>
          <LinearGradient
            colors={[colors.goldFaint, 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroGlow}
            pointerEvents="none"
          />
          <Text style={styles.heroLabel}>{isTournament ? 'TOURNAMENT COMPLETE' : 'GAME OVER'}</Text>
          <AnimatedNumber
            value={totalPotCents}
            format={formatCents}
            style={styles.heroPot}
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.3}
          />
          <Text style={styles.heroMeta}>
            total buy-ins · {game.players.length} players
            {game.endedAt ? ` · ${formatDuration(game.createdAt, game.endedAt)}` : ''}
          </Text>
          {isTournament && game.tournament && (
            <Text style={styles.heroMeta}>
              {game.txns.filter(t => t.kind === 'buyin').length} entries · top {game.tournament.payouts.length} paid
            </Text>
          )}
          {championName && (
            <View style={styles.championRow}>
              <Ionicons name="trophy" size={iconSize.xs} color={colors.goldLight} accessibilityLabel="Champion" />
              <Text style={[styles.championName, { writingDirection: nameWritingDirection(championName) }]} numberOfLines={1}>{championName}</Text>
              {championSub && <Text style={styles.championSub}>{championSub}</Text>}
            </View>
          )}
        </MotiView>

        {/* Tournament podium */}
        {podium && (
          <>
            <Text style={styles.sectionTitle}>FINAL STANDINGS</Text>
            {podium.map(({ player, position, payoutCents, netCents }, index) => {
              const isChampion = position === 1;
              return (
                <MotiView
                  key={player.id}
                  {...entrance({ reduced, delay: staggerIn(index) })}
                  style={[styles.resultRow, isChampion && styles.resultRowWinner]}
                >
                  <Text style={[styles.resultRank, isChampion && styles.resultRankWinner]}>
                    {`#${position}`}
                  </Text>
                  <View style={styles.podiumInfo}>
                    <View style={styles.podiumNameRow}>
                      <Text style={[styles.podiumName, { writingDirection: nameWritingDirection(player.name) }]} numberOfLines={1}>{player.name}</Text>
                      {payoutCents > 0 && <Chip label="ITM" tone="gold" style={{ alignSelf: 'center' }} />}
                    </View>
                    {payoutCents > 0 && (
                      <Text style={styles.podiumPayout}>wins {formatCents(payoutCents)}</Text>
                    )}
                  </View>
                  <Text style={[
                    styles.resultNet,
                    netCents > 0 ? styles.netPositive : netCents < 0 ? styles.netNegative : styles.netEven,
                  ]}>
                    {formatCentsSigned(netCents)}
                  </Text>
                </MotiView>
              );
            })}
          </>
        )}

        {/* Cash settlements — the one screen a reviewer (or a new user) is most likely to
            misread as the app moving money. Say plainly, on-screen, that it never does. */}
        <Text style={styles.sectionTitle}>CASH SETTLEMENTS</Text>
        <Text style={styles.settleNote}>
          Settle in person — T Poker records who owes what and never moves, holds, or processes money.
        </Text>
        {transfers.length === 0 ? (
          <View style={styles.evenCard}>
            <Ionicons name="checkmark-circle-outline" size={iconSize.sm} color={colors.success} />
            <Text style={styles.evenText}>Everyone is even — no payments needed.</Text>
          </View>
        ) : (
          transfers.map((t, i) => (
            <MotiView key={i} {...entrance({ reduced, delay: staggerIn(i) })} style={styles.transferRow}>
              <View style={styles.transferNames}>
                <Text style={[styles.transferPayer, { writingDirection: nameWritingDirection(playerName(t.fromPlayerId)) }]} numberOfLines={1}>{playerName(t.fromPlayerId)}</Text>
                <Ionicons name="arrow-forward" size={iconSize.xs} color={colors.gold} />
                <Text style={[styles.transferReceiver, { writingDirection: nameWritingDirection(playerName(t.toPlayerId)) }]} numberOfLines={1}>{playerName(t.toPlayerId)}</Text>
              </View>
              <Text style={styles.transferAmount}>{formatCents(t.amountCents)}</Text>
            </MotiView>
          ))
        )}

        <View style={{ height: spacing.xxxl }} />
        {user === null && (
          <PressableScale
            style={styles.saveCard}
            onPress={() => { markSignupIntent(); navigation.navigate('Login'); }}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Save this game to a free account to keep your history across devices"
          >
            <View style={styles.saveIconWrap}>
              <Ionicons name="cloud-upload-outline" size={iconSize.sm} color={colors.gold} />
            </View>
            <View style={styles.saveText}>
              <Text style={styles.saveTitle}>Save this game</Text>
              <Text style={styles.saveSub}>Create a free account to keep your stats, groups, and history across devices.</Text>
            </View>
            <Ionicons name="chevron-forward" size={iconSize.xs} color={colors.textMuted} />
          </PressableScale>
        )}
        {isFeatureEnabled('retention') && (isFeatureEnabled('bankroll') || isFeatureEnabled('coach')) && (
          <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            {isFeatureEnabled('bankroll') && (
              <CrossPillarCTA
                icon="wallet-outline"
                label="Log to Bankroll"
                sub="Track this session in your bankroll"
                onPress={() => navigation.navigate('LogSession')}
              />
            )}
            {isFeatureEnabled('coach') && (
              <CrossPillarCTA
                icon="sparkles"
                label="Analyze a hand"
                sub="Get an AI read on a tough spot"
                onPress={() => navigation.navigate('CoachInput', { method: 'manual' })}
              />
            )}
          </View>
        )}
        <PrimaryButton label="Done" onPress={() => navigation.popToTop()} />
        <View style={{ height: spacing.huge }} />
        </ContentContainer>
      </ScrollView>
      {justEnded && <Celebration variant="celebration" />}
      <ShareCard ref={shareRef} data={shareData} />
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
  headerTitle: { flex: 1, ...typography.h3, color: colors.text, textAlign: 'center' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },

  scroll: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.sm },

  heroCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    gap: spacing.xs,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.goldSm,
  },
  heroGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 150 },
  heroLabel: { ...typography.caps, color: colors.goldLight, letterSpacing: 2 },
  heroPot: { ...typography.amountHero, color: colors.text },
  heroMeta: { ...typography.bodySmall, color: colors.textMuted },

  championRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  championName: { fontFamily: Sora['700'], fontSize: 16, color: colors.goldLight },
  championSub: { ...typography.amount, fontSize: 14, color: colors.textMuted },

  sectionTitle: {
    ...typography.caps,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTitleFirst: { marginTop: 0 },
  settleNote: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 18 },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  resultRowWinner: { borderColor: colors.goldMuted, backgroundColor: colors.goldFaint },
  resultRank: { width: 34, fontSize: 14, fontWeight: '700', color: colors.textMuted, fontVariant: ['tabular-nums'] },
  resultRankWinner: { fontSize: 18 },
  resultName: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'left' },
  podiumInfo: { flex: 1, gap: spacing.xs },
  podiumNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  podiumName: { fontSize: 16, fontWeight: '600', color: colors.text },
  podiumPayout: { fontSize: 12, fontWeight: '600', color: colors.goldLight },
  resultNet: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  netPositive: { color: colors.success },
  netNegative: { color: colors.error },
  netEven: { color: colors.textMuted },

  evenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  evenText: { flex: 1, fontSize: 14, color: colors.textMuted },

  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transferNames: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  transferPayer: { fontSize: 15, fontWeight: '600', color: colors.text },
  transferReceiver: { fontSize: 15, fontWeight: '600', color: colors.goldLight },
  transferAmount: { fontSize: 16, fontWeight: '800', color: colors.gold, fontVariant: ['tabular-nums'] },

  saveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  saveIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { flex: 1, gap: spacing.xs },
  saveTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  saveSub: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
