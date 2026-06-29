import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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
import { RootStackParamList } from '../navigation/AppNavigator';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { useLocalGames } from '../context/LocalGamesContext';
import { settleGame } from '../local/settlements';
import { contributionCents, tournamentResult } from '../local/tournament';
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

type Props = NativeStackScreenProps<RootStackParamList, 'LocalSessionSummary'>;

/** Results + cash settlements for a finished local game. */
export default function LocalSessionSummaryScreen({ route, navigation }: Props) {
  const { gameId } = route.params;
  const insets = useSafeAreaInsets();
  const { games, deleteGame } = useLocalGames();
  const { user } = useAuth();

  const game = games.find(g => g.id === gameId);
  const isTournament = game?.mode === 'tournament';
  const shareRef = React.useRef<View>(null);

  const { results, transfers, totalPotCents, podium } = useMemo(() => {
    if (!game) return { results: [], transfers: [], totalPotCents: 0, podium: null };

    if (game.mode === 'tournament' && game.tournament) {
      const result = tournamentResult(game);
      const podium = result.standings.map(s => ({
        player: game.players.find(p => p.id === s.playerId)!,
        position: s.position,
        payoutCents: s.payoutCents,
        netCents: s.payoutCents - contributionCents(game, s.playerId),
      }));
      return {
        results: [],
        transfers: result.transfers,
        totalPotCents: result.poolCents,
        podium,
      };
    }

    const { balances, transfers } = settleGame(game);
    const results = game.players
      .map(player => ({
        player,
        netCents: balances.find(b => b.playerId === player.id)?.netCents ?? 0,
      }))
      .sort((a, b) => b.netCents - a.netCents);
    const totalPotCents = game.txns
      .filter(t => t.kind === 'buyin')
      .reduce((s, t) => s + t.amountCents, 0);
    return { results, transfers, totalPotCents, podium: null };
  }, [game]);

  if (!game) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <EmptyState
          ionicon="alert-circle-outline"
          title="Game not found"
          subtitle="This local game may have been deleted."
          action={{ label: 'Go Home', onPress: () => navigation.popToTop() }}
        />
      </View>
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
    potLabel: isTournament ? 'PRIZE POOL' : 'TOTAL POT',
    potCents: totalPotCents,
    dateText: formatDate(game.endedAt ?? game.createdAt),
    rows: podium
      ? podium.slice(0, 3).map(p => ({
          name: p.player.name,
          valueText: p.payoutCents > 0 ? `wins ${formatCents(p.payoutCents)}` : formatCentsSigned(p.netCents),
          positive: p.netCents >= 0,
          medal: p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : '🥉',
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
    <View style={styles.flex}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.popToTop()} hitSlop={12} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Close summary">
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{game.name}</Text>
        <View style={styles.headerActions}>
          {canShareImages && (
            <TouchableOpacity style={styles.backBtn} onPress={handleShareImage} hitSlop={12} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Share result card">
              <Ionicons name="share-outline" size={18} color={colors.gold} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.backBtn} onPress={handleDelete} hitSlop={12} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Delete this game">
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
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
                <View key={player.id} style={[styles.resultRow, isWinner && styles.resultRowWinner]}>
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
                </View>
              );
            })}
          </>
        )}
        {/* Game over hero (celebration) */}
        <View style={styles.heroCard}>
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
            {isTournament ? 'prize pool' : 'total pot'} · {game.players.length} players
            {game.endedAt ? ` · ${formatDuration(game.createdAt, game.endedAt)}` : ''}
          </Text>
          {isTournament && game.tournament && (
            <Text style={styles.heroMeta}>
              {game.txns.filter(t => t.kind === 'buyin').length} entries · top {game.tournament.payouts.length} paid
            </Text>
          )}
          {championName && (
            <View style={styles.championRow}>
              <Ionicons name="trophy" size={16} color={colors.goldLight} accessibilityLabel="Champion" />
              <Text style={[styles.championName, { writingDirection: nameWritingDirection(championName) }]} numberOfLines={1}>{championName}</Text>
              {championSub && <Text style={styles.championSub}>{championSub}</Text>}
            </View>
          )}
        </View>

        {/* Tournament podium */}
        {podium && (
          <>
            <Text style={styles.sectionTitle}>FINAL STANDINGS</Text>
            {podium.map(({ player, position, payoutCents, netCents }) => {
              const isChampion = position === 1;
              return (
                <View key={player.id} style={[styles.resultRow, isChampion && styles.resultRowWinner]}>
                  <Text style={[styles.resultRank, isChampion && styles.resultRankWinner]}>
                    {`#${position}`}
                  </Text>
                  <View style={styles.podiumInfo}>
                    <View style={styles.podiumNameRow}>
                      <Text style={[styles.podiumName, { writingDirection: nameWritingDirection(player.name) }]} numberOfLines={1}>{player.name}</Text>
                      {payoutCents > 0 && (
                        <View style={styles.itmBadge}><Text style={styles.itmBadgeText}>ITM</Text></View>
                      )}
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
                </View>
              );
            })}
          </>
        )}

        {/* Cash settlements */}
        <Text style={styles.sectionTitle}>CASH SETTLEMENTS</Text>
        {transfers.length === 0 ? (
          <View style={styles.evenCard}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
            <Text style={styles.evenText}>Everyone is even — no payments needed.</Text>
          </View>
        ) : (
          transfers.map((t, i) => (
            <View key={i} style={styles.transferRow}>
              <View style={styles.transferNames}>
                <Text style={[styles.transferPayer, { writingDirection: nameWritingDirection(playerName(t.fromPlayerId)) }]} numberOfLines={1}>{playerName(t.fromPlayerId)}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.gold} />
                <Text style={[styles.transferReceiver, { writingDirection: nameWritingDirection(playerName(t.toPlayerId)) }]} numberOfLines={1}>{playerName(t.toPlayerId)}</Text>
              </View>
              <Text style={styles.transferAmount}>{formatCents(t.amountCents)}</Text>
            </View>
          ))
        )}

        <View style={{ height: 32 }} />
        {user === null && (
          <TouchableOpacity
            style={styles.saveCard}
            onPress={() => { markSignupIntent(); navigation.navigate('Login'); }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save this game to a free account to keep your history across devices"
          >
            <View style={styles.saveIconWrap}>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.gold} />
            </View>
            <View style={styles.saveText}>
              <Text style={styles.saveTitle}>Save this game</Text>
              <Text style={styles.saveSub}>Create a free account to keep your stats, groups, and history across devices.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        {isFeatureEnabled('retention') && (isFeatureEnabled('bankroll') || isFeatureEnabled('coach')) && (
          <View style={{ gap: 10, marginBottom: 16 }}>
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
        <View style={{ height: 40 }} />
        </ContentContainer>
      </ScrollView>
      {justEnded && <Celebration />}
      <ShareCard ref={shareRef} data={shareData} />
    </View>
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
  headerTitle: { flex: 1, ...typography.h3, color: colors.text, textAlign: 'center' },
  headerActions: { flexDirection: 'row', gap: 8 },

  scroll: { flex: 1 },
  content: { padding: 20, gap: 10 },

  heroCard: {
    alignItems: 'center',
    paddingVertical: 28,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    gap: 4,
    marginBottom: 10,
    overflow: 'hidden',
    ...shadows.goldSm,
  },
  heroGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 150 },
  heroLabel: { ...typography.caps, color: colors.goldLight, letterSpacing: 2 },
  heroPot: { ...typography.amountHero, color: colors.text },
  heroMeta: { ...typography.bodySmall, color: colors.textMuted },

  championRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  championName: { fontFamily: Sora['700'], fontSize: 16, color: colors.goldLight },
  championSub: { ...typography.amount, fontSize: 14, color: colors.textMuted },

  sectionTitle: {
    ...typography.caps,
    color: colors.textMuted,
    marginTop: 14,
    marginBottom: 2,
  },
  sectionTitleFirst: { marginTop: 0 },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  resultRowWinner: { borderColor: colors.goldMuted, backgroundColor: colors.goldFaint },
  resultRank: { width: 34, fontSize: 14, fontWeight: '700', color: colors.textMuted },
  resultRankWinner: { fontSize: 18 },
  resultName: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'left' },
  podiumInfo: { flex: 1, gap: 2 },
  podiumNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  podiumName: { fontSize: 16, fontWeight: '600', color: colors.text },
  itmBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
  },
  itmBadgeText: { fontSize: 9, fontWeight: '800', color: colors.goldLight, letterSpacing: 0.5 },
  podiumPayout: { fontSize: 12, fontWeight: '600', color: colors.goldLight },
  resultNet: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  netPositive: { color: colors.success },
  netNegative: { color: colors.error },
  netEven: { color: colors.textMuted },

  evenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  evenText: { flex: 1, fontSize: 14, color: colors.textMuted },

  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transferNames: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  transferPayer: { fontSize: 15, fontWeight: '600', color: colors.text },
  transferReceiver: { fontSize: 15, fontWeight: '600', color: colors.goldLight },
  transferAmount: { fontSize: 16, fontWeight: '800', color: colors.gold, fontVariant: ['tabular-nums'] },

  saveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    gap: 12,
    marginBottom: 16,
  },
  saveIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { flex: 1, gap: 3 },
  saveTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  saveSub: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
