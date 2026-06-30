import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import { RootStackParamList } from '../navigation/AppNavigator';
import SessionListItem from '../components/SessionListItem';
import SectionTitle from '../components/SectionTitle';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import PressableScale from '../components/motion/PressableScale';
import SwipeableRow from '../components/SwipeableRow';
import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLocalGames } from '../context/LocalGamesContext';
import { gameResult } from '../local/localStats';
import { formatCents } from '../utils/money';
import { timeAgo } from '../utils/formatters';
import { confirmDialog } from '../utils/confirm';
import { mediumTap } from '../utils/haptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Sessions tab for guests: every game on this device, live game first. */
export default function LocalSessionsScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { games, activeGame, deleteGame } = useLocalGames();

  const finished = games.filter(g => g.status === 'Finished');

  if (games.length === 0) {
    return (
      <Screen style={{ paddingTop: embedded ? 0 : insets.top }}>
        {!embedded && <Text style={styles.titleStandalone}>Sessions</Text>}
        <EmptyState
          ionicon="card-outline"
          title="No games yet"
          subtitle="Games you play on this device show up here. Start your first one — no account needed."
          action={{ label: 'Start a Game', onPress: () => navigation.navigate('LocalNewGame', { mode: 'cash' }) }}
        />
        <PressableScale
          style={styles.tournamentLink}
          onPress={() => navigation.navigate('LocalNewGame', { mode: 'tournament' })}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Host a tournament"
        >
          <Ionicons name="trophy-outline" size={iconSize.xs} color={colors.gold} />
          <Text style={styles.tournamentLinkText}>or host a Tournament</Text>
        </PressableScale>
      </Screen>
    );
  }

  return (
    <Screen>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: embedded ? spacing.sm : insets.top + spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      {!embedded && <Text style={styles.title}>Sessions</Text>}

      {activeGame && (
        <View style={styles.section}>
          <SectionTitle>LIVE NOW</SectionTitle>
          <View style={styles.sectionCard}>
            <SessionListItem
              name={activeGame.name}
              meta={`${activeGame.players.length} players · started ${timeAgo(activeGame.createdAt)}`}
              status="Active"
              onPress={() => navigation.navigate('LocalSession', { gameId: activeGame.id })}
              isFirst
            />
          </View>
        </View>
      )}

      {finished.length > 0 && (
        <View style={styles.section}>
          <SectionTitle>FINISHED</SectionTitle>
          <View style={styles.sectionCard}>
            {finished.map((game, i) => {
              const result = gameResult(game);
              return (
                <MotiView key={game.id} {...slideUpSequence({ reduced, delay: staggerIn(i) })}>
                  <SwipeableRow
                    actionLabel="Delete"
                    actionIcon="trash-outline"
                    onAction={() =>
                      confirmDialog(
                        'Delete game?',
                        `"${game.name}" and its results will be permanently removed from this device.`,
                        'Delete',
                        async () => { mediumTap(); await deleteGame(game.id); },
                        { destructive: true },
                      )
                    }
                  >
                    <SessionListItem
                      name={game.name}
                      meta={`${result.playerCount} players · ${formatCents(result.totalPotCents)} pot · ${timeAgo(result.endedAt)}`}
                      onPress={() => navigation.navigate('LocalSessionSummary', { gameId: game.id })}
                      isFirst={i === 0}
                    />
                  </SwipeableRow>
                </MotiView>
              );
            })}
          </View>
        </View>
      )}

      {!activeGame && (
        <PrimaryButton label="+ New Game" onPress={() => navigation.navigate('LocalNewGame')} />
      )}

      <View style={{ height: spacing.huge * 2 }} />
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.displaySerif, color: colors.text },
  titleStandalone: { ...typography.displaySerif, color: colors.text, marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  section: { gap: spacing.sm },
  sectionCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tournamentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingVertical: spacing.md,
    marginBottom: spacing.xxl,
  },
  tournamentLinkText: { ...typography.label, color: colors.gold },
});
