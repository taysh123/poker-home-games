import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { RootStackParamList } from '../navigation/AppNavigator';
import SessionListItem from '../components/SessionListItem';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { useLocalGames } from '../context/LocalGamesContext';
import { gameResult } from '../local/localStats';
import { formatCents } from '../utils/money';
import { timeAgo } from '../utils/formatters';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Sessions tab for guests: every game on this device, live game first. */
export default function LocalSessionsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { games, activeGame } = useLocalGames();

  const finished = games.filter(g => g.status === 'Finished');

  if (games.length === 0) {
    return (
      <Screen style={{ paddingTop: insets.top }}>
        <Text style={[styles.title, { marginTop: 20, paddingHorizontal: 20 }]}>Sessions</Text>
        <EmptyState
          ionicon="card-outline"
          title="No games yet"
          subtitle="Games you play on this device show up here. Start your first one — no account needed."
          action={{ label: 'Start a Game', onPress: () => navigation.navigate('LocalNewGame') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
    <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Sessions</Text>

      {activeGame && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LIVE NOW</Text>
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
          <Text style={styles.sectionTitle}>FINISHED</Text>
          <View style={styles.sectionCard}>
            {finished.map((game, i) => {
              const result = gameResult(game);
              return (
                <SessionListItem
                  key={game.id}
                  name={game.name}
                  meta={`${result.playerCount} players · ${formatCents(result.totalPotCents)} pot · ${timeAgo(result.endedAt)}`}
                  onPress={() => navigation.navigate('LocalSessionSummary', { gameId: game.id })}
                  isFirst={i === 0}
                />
              );
            })}
          </View>
        </View>
      )}

      {!activeGame && (
        <PrimaryButton label="+ New Game" onPress={() => navigation.navigate('LocalNewGame')} />
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 16 },
  title: { ...typography.displaySerif, color: colors.text, paddingHorizontal: 0 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
