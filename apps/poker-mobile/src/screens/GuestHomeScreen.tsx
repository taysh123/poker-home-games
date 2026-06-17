import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { RootStackParamList } from '../navigation/AppNavigator';
import SessionListItem from '../components/SessionListItem';
import Screen from '../components/Screen';
import { useLocalGames } from '../context/LocalGamesContext';
import { gameResult } from '../local/localStats';
import { formatCents } from '../utils/money';
import { timeAgo } from '../utils/formatters';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Home tab for guests (no account): start/resume local games, sign-in upsell. */
export default function GuestHomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { games, activeGame } = useLocalGames();

  const recentFinished = games.filter(g => g.status === 'Finished').slice(0, 5);

  return (
    <Screen>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120 }]}
    >
      {/* Brand header */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <View style={styles.logoBadge}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
          </View>
          <View>
            <Text style={styles.brand}>T POKER</Text>
            <Text style={styles.tagline}>Your home game, handled.</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.signInBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.8}>
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>

      {/* Active game */}
      {activeGame && (
        <TouchableOpacity
          style={styles.activeCard}
          onPress={() => navigation.navigate('LocalSession', { gameId: activeGame.id })}
          activeOpacity={0.85}
        >
          <View style={styles.activeDotWrap}>
            <View style={styles.activeDot} />
          </View>
          <View style={styles.activeInfo}>
            <Text style={styles.activeName} numberOfLines={1}>{activeGame.name}</Text>
            <Text style={styles.activeMeta}>
              Live · {activeGame.players.length} players · started {timeAgo(activeGame.createdAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gold} />
        </TouchableOpacity>
      )}

      {/* Start a game — Cash and Tournament as first-class choices */}
      {!activeGame && (
        <View style={styles.heroSection}>
          <Text style={styles.heroLead}>
            Start a game — right now, no account needed.
          </Text>
          <View style={styles.heroRow}>
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => navigation.navigate('LocalNewGame', { mode: 'cash' })}
              activeOpacity={0.85}
            >
              <View style={styles.heroIconWrap}>
                <Ionicons name="play" size={22} color={colors.background} style={{ marginLeft: 2 }} />
              </View>
              <Text style={styles.heroTitle}>Cash Game</Text>
              <Text style={styles.heroSubtitle}>Buy-ins, cash-outs, settle up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => navigation.navigate('LocalNewGame', { mode: 'tournament' })}
              activeOpacity={0.85}
            >
              <View style={[styles.heroIconWrap, styles.heroIconWrapAlt]}>
                <Ionicons name="trophy" size={20} color={colors.gold} />
              </View>
              <Text style={styles.heroTitle}>Tournament</Text>
              <Text style={styles.heroSubtitle}>Blind clock, prize pool, podium</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Recent local games */}
      {recentFinished.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT GAMES</Text>
          <View style={styles.sectionCard}>
            {recentFinished.map((game, i) => {
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

      {/* Sign-in upsell */}
      <TouchableOpacity style={styles.upsellCard} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
        <View style={styles.upsellIconWrap}>
          <Ionicons name="cloud-upload-outline" size={20} color={colors.gold} />
        </View>
        <View style={styles.upsellText}>
          <Text style={styles.upsellTitle}>Make it official</Text>
          <Text style={styles.upsellSubtitle}>
            Create a free account for groups, lifetime stats, leaderboards, and game history across devices.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 16 },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logoBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: 38, height: 38 },
  brand: { ...typography.displaySerif, fontSize: 27, color: colors.text, letterSpacing: 2.5 },
  tagline: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  signInBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  signInBtnText: { fontSize: 13, fontWeight: '700', color: colors.gold },

  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.gold,
    gap: 12,
    ...shadows.goldSm,
  },
  activeDotWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  activeInfo: { flex: 1, gap: 2 },
  activeName: { fontSize: 15, fontWeight: '700', color: colors.text },
  activeMeta: { fontSize: 12, color: colors.textMuted },

  heroSection: { gap: 10 },
  heroLead: { fontSize: 13, color: colors.textMuted },
  heroRow: { flexDirection: 'row', gap: 12 },
  heroCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    gap: 7,
    ...shadows.goldSm,
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  heroIconWrapAlt: {
    backgroundColor: colors.goldFaint,
    borderWidth: 1.5,
    borderColor: colors.goldMuted,
  },
  heroTitle: { ...typography.h3, color: colors.text },
  heroSubtitle: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  upsellIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellText: { flex: 1, gap: 3 },
  upsellTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  upsellSubtitle: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
