import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getMyGroups, MyGroupDto } from '../api/groupsApi';
import { RootStackParamList } from '../navigation/AppNavigator';

type HomeNav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<HomeNav>();
  const [loggingOut, setLoggingOut] = useState(false);
  const [groups, setGroups] = useState<MyGroupDto[]>([]);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const data = await getMyGroups(token);
      setGroups(data);
    } catch {
      // silently ignore — home screen is non-critical
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  const initial = user?.username?.[0]?.toUpperCase() ?? '?';
  const previewGroups = groups.slice(0, 3);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.username}>{user?.username ?? 'Player'}</Text>
        </View>
        <TouchableOpacity
          style={styles.avatar}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.7}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.gold} size="small" />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, loggingOut && styles.logoutButtonDisabled]}
        onPress={handleLogout}
        disabled={loggingOut}
        activeOpacity={0.8}
      >
        {loggingOut ? (
          <ActivityIndicator color={colors.textMuted} size="small" />
        ) : (
          <Text style={styles.logoutText}>Sign Out</Text>
        )}
      </TouchableOpacity>

      {/* My Groups */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Groups</Text>
          {groups.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('GroupsList')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          )}
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>♠</Text>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySubtitle}>Create or join a poker group to get started</Text>
            <TouchableOpacity
              style={styles.createButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CreateGroup')}
            >
              <Text style={styles.createButtonText}>+ Create Group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.groupsCard}>
            {previewGroups.map((g, i) => (
              <React.Fragment key={g.id}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.groupRow}
                  onPress={() => navigation.navigate('GroupDetail', { groupId: g.id, groupName: g.name })}
                  activeOpacity={0.7}
                >
                  <View style={styles.groupRowLeft}>
                    <Text style={styles.groupRowName}>{g.name}</Text>
                    <Text style={styles.groupRowMeta}>{g.memberCount} member{g.memberCount !== 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={styles.groupRowChevron}>›</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
            {groups.length > 3 && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.groupRow}
                  onPress={() => navigation.navigate('GroupsList')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moreGroupsText}>+{groups.length - 3} more groups</Text>
                  <Text style={styles.groupRowChevron}>›</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₪0</Text>
            <Text style={styles.statLabel}>Total Won</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{groups.length}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
        </View>
      </View>

      {/* Recent Sessions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptySubtitle}>No sessions played yet</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  greeting: {
    fontSize: 13,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gold,
  },
  logoutButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 28,
  },
  logoutButtonDisabled: {
    opacity: 0.5,
  },
  logoutText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  seeAll: {
    fontSize: 13,
    color: colors.gold,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 36,
    color: colors.gold,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  createButton: {
    marginTop: 16,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.background,
  },
  groupsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  groupRowLeft: {
    flex: 1,
    gap: 2,
  },
  groupRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  groupRowMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  groupRowChevron: {
    fontSize: 20,
    color: colors.textDim,
    fontWeight: '300',
  },
  moreGroupsText: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.gold,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
