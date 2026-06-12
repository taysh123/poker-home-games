import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { RootStackParamList } from '../navigation/AppNavigator';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { useLocalGames } from '../context/LocalGamesContext';
import { settleGame } from '../local/settlements';
import { formatCents, formatCentsSigned } from '../utils/money';
import { formatDuration } from '../utils/formatters';
import { confirmDialog } from '../utils/confirm';
import AnimatedNumber from '../components/motion/AnimatedNumber';

type Props = NativeStackScreenProps<RootStackParamList, 'LocalSessionSummary'>;

/** Results + cash settlements for a finished local game. */
export default function LocalSessionSummaryScreen({ route, navigation }: Props) {
  const { gameId } = route.params;
  const insets = useSafeAreaInsets();
  const { games, deleteGame } = useLocalGames();

  const game = games.find(g => g.id === gameId);

  const { results, transfers, totalPotCents } = useMemo(() => {
    if (!game) return { results: [], transfers: [], totalPotCents: 0 };
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
    return { results, transfers, totalPotCents };
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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.popToTop()} hitSlop={12} activeOpacity={0.75}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{game.name}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={handleDelete} hitSlop={12} activeOpacity={0.75}>
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Game over hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>GAME OVER</Text>
          <AnimatedNumber value={totalPotCents} format={formatCents} style={styles.heroPot} />
          <Text style={styles.heroMeta}>
            total pot · {game.players.length} players
            {game.endedAt ? ` · ${formatDuration(game.createdAt, game.endedAt)}` : ''}
          </Text>
        </View>

        {/* Results */}
        <Text style={styles.sectionTitle}>RESULTS</Text>
        {results.map(({ player, netCents }, index) => {
          const isWinner = index === 0 && netCents > 0;
          return (
            <View key={player.id} style={[styles.resultRow, isWinner && styles.resultRowWinner]}>
              <Text style={[styles.resultRank, isWinner && styles.resultRankWinner]}>
                {isWinner ? '🏆' : `#${index + 1}`}
              </Text>
              <Text style={styles.resultName} numberOfLines={1}>{player.name}</Text>
              <Text style={[
                styles.resultNet,
                netCents > 0 ? styles.netPositive : netCents < 0 ? styles.netNegative : styles.netEven,
              ]}>
                {formatCentsSigned(netCents)}
              </Text>
            </View>
          );
        })}

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
                <Text style={styles.transferPayer}>{playerName(t.fromPlayerId)}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.gold} />
                <Text style={styles.transferReceiver}>{playerName(t.toPlayerId)}</Text>
              </View>
              <Text style={styles.transferAmount}>{formatCents(t.amountCents)}</Text>
            </View>
          ))
        )}

        <View style={{ height: 32 }} />
        <PrimaryButton label="Done" onPress={() => navigation.popToTop()} />
        <View style={{ height: 40 }} />
      </ScrollView>
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

  scroll: { flex: 1 },
  content: { padding: 20, gap: 10 },

  heroCard: {
    alignItems: 'center',
    paddingVertical: 26,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    gap: 4,
    marginBottom: 10,
    ...shadows.goldSm,
  },
  heroLabel: { fontSize: 11, fontWeight: '700', color: colors.goldLight, letterSpacing: 2 },
  heroPot: { ...typography.amountLarge, color: colors.text },
  heroMeta: { fontSize: 13, color: colors.textMuted },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 2,
  },

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
  resultName: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
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
});
