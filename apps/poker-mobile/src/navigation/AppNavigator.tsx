import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { NavigationContainer, NavigationContainerRef, useNavigation, LinkingOptions } from '@react-navigation/native';
import { NativeStackNavigationProp, createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useLocalGames } from '../context/LocalGamesContext';
import { consumePendingInvite } from '../utils/pendingInvite';
import { usePushNotificationListeners } from '../hooks/usePushNotifications';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import AllSessionsScreen from '../screens/AllSessionsScreen';
import GroupsListScreen from '../screens/GroupsListScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import InvitationsScreen from '../screens/InvitationsScreen';
import EditGroupScreen from '../screens/EditGroupScreen';
import SessionsListScreen from '../screens/SessionsListScreen';
import SessionScreen from '../screens/SessionScreen';
import StatsScreen from '../screens/StatsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NewGameScreen from '../screens/NewGameScreen';
import PendingSettlementsScreen from '../screens/PendingSettlementsScreen';
import JoinSessionScreen from '../screens/JoinSessionScreen';
import JoinGroupScreen from '../screens/JoinGroupScreen';
import PlayerProfileScreen from '../screens/PlayerProfileScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import LocalNewGameScreen from '../screens/LocalNewGameScreen';
import LocalSessionScreen from '../screens/LocalSessionScreen';
import LocalSessionSummaryScreen from '../screens/LocalSessionSummaryScreen';
import GuestHomeScreen from '../screens/GuestHomeScreen';
import LocalSessionsScreen from '../screens/LocalSessionsScreen';
import GroupsAuthGateScreen from '../screens/GroupsAuthGateScreen';
import GuestStatsScreen from '../screens/GuestStatsScreen';
import GlassView from '../components/motion/GlassView';
import Toast from '../components/Toast';
import * as storage from '../utils/storage';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  Profile: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string; groupName: string; showInviteOnLoad?: boolean };
  Invitations: undefined;
  EditGroup: { groupId: string; groupName: string; description?: string };
  SessionsList: { groupId: string; groupName: string; userRole: string };
  Session: { sessionId: string; groupId: string };
  NewGame: { groupId?: string; groupName?: string };
  PendingSettlements: undefined;
  JoinSession: { inviteToken: string };
  JoinGroup: { inviteToken: string };
  PlayerProfile: { userId: string; username: string };
  Notifications: undefined;
  // Local (on-device) games — available to guests and logged-in users
  LocalNewGame: { mode?: 'cash' | 'tournament' } | undefined;
  LocalSession: { gameId: string };
  LocalSessionSummary: { gameId: string };
  // Kept for TypeScript compat on existing screens that navigate to these by name
  Home: undefined;
  AllSessions: undefined;
  GroupsList: undefined;
  Stats: undefined;
};

export type TabParamList = {
  Home: undefined;
  AllSessions: undefined;
  GroupsList: undefined;
  Stats: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Deep-link / universal-link routing. Maps shareable invite URLs to screens so
// https://<web>/join/group/:token (and the tpoker:// scheme) open the right join
// flow. Param name must be `inviteToken` to match RootStackParamList. The guest
// tree's JoinGroup/JoinSession screens stash a pending invite and resume after
// sign-in (see consumePendingInvite below).
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://poker-home-games-three.vercel.app', 'tpoker://'],
  config: {
    screens: {
      JoinGroup: 'join/group/:inviteToken',
      JoinSession: 'join/session/:inviteToken',
    },
  },
};

const stackScreenOptions = {
  contentStyle: { backgroundColor: colors.background },
  animation: 'slide_from_right' as const,
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
};

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 56;

function LiveGameBar() {
  const { activeSession } = useActiveSession();
  const { activeGame } = useLocalGames();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  // Server session wins when both exist; local games keep the bar alive for guests.
  const entry = activeSession
    ? {
        title: activeSession.sessionName,
        sub: 'Live game · tap to return',
        onPress: () => navigation.navigate('Session', {
          sessionId: activeSession.sessionId,
          groupId: activeSession.groupId ?? '',
        }),
      }
    : activeGame
      ? {
          title: activeGame.name,
          sub: 'Live local game · tap to return',
          onPress: () => navigation.navigate('LocalSession', { gameId: activeGame.id }),
        }
      : null;

  const hasEntry = entry != null;
  const translateY = useSharedValue(80);
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    translateY.value = withSpring(hasEntry ? 0 : 80, { damping: 18, stiffness: 160 });
  }, [hasEntry, translateY]);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
    );
  }, [pulse]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (!entry) return null;

  return (
    <Reanimated.View
      style={[
        liveBarStyles.barWrap,
        { bottom: TAB_BAR_HEIGHT + insets.bottom + 8 },
        barStyle,
      ]}
    >
      <TouchableOpacity style={liveBarStyles.bar} onPress={entry.onPress} activeOpacity={0.9}>
        <View style={liveBarStyles.dotWrapper}>
          <Reanimated.View style={[liveBarStyles.dot, dotStyle]} />
        </View>
        <View style={liveBarStyles.textGroup}>
          <Text style={liveBarStyles.title} numberOfLines={1}>{entry.title}</Text>
          <Text style={liveBarStyles.sub}>{entry.sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.gold} />
      </TouchableOpacity>
    </Reanimated.View>
  );
}

/** Mounts push-notification listeners; must live inside NavigationContainer. */
function PushListeners() {
  usePushNotificationListeners();
  return null;
}

/** Tab icon with a spring pop when its tab gains focus. */
function TabIcon({ name, color, size, focused }: { name: IoniconsName; color: string; size: number; focused: boolean }) {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.18, { damping: 12, stiffness: 320 }),
        withSpring(1, { damping: 15, stiffness: 280 }),
      );
    }
  }, [focused, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Reanimated.View style={style}>
      <Ionicons name={name} size={size} color={color} />
    </Reanimated.View>
  );
}

/** Shared tab styling for both the authed and guest tab navigators. */
function tabScreenOptions({ route }: { route: { name: string } }) {
  const icons: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
    Home:        { active: 'home',      inactive: 'home-outline' },
    AllSessions: { active: 'card',      inactive: 'card-outline' },
    GroupsList:  { active: 'people',    inactive: 'people-outline' },
    Stats:       { active: 'bar-chart', inactive: 'bar-chart-outline' },
  };
  return {
    tabBarStyle: {
      // iOS: transparent over a GlassView blur; elsewhere: today's solid surface.
      backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.surface,
      ...(Platform.OS === 'ios' ? { position: 'absolute' as const } : null),
      borderTopColor: colors.border,
      borderTopWidth: 1,
      height: TAB_BAR_HEIGHT + (Platform.OS === 'ios' ? 0 : 8),
      paddingBottom: Platform.OS === 'ios' ? 0 : 4,
      paddingTop: 4,
    },
    ...(Platform.OS === 'ios'
      ? { tabBarBackground: () => <GlassView style={StyleSheet.absoluteFill} /> }
      : null),
    tabBarActiveTintColor: colors.gold,
    tabBarInactiveTintColor: colors.textDim,
    tabBarLabelStyle: {
      fontSize: 10,
      fontWeight: '600' as const,
      letterSpacing: 0.3,
      marginTop: 2,
    },
    tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
      const pair = icons[route.name] ?? { active: 'ellipse' as IoniconsName, inactive: 'ellipse-outline' as IoniconsName };
      return <TabIcon name={focused ? pair.active : pair.inactive} size={size - 2} color={color} focused={focused} />;
    },
  };
}

function TabNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator screenOptions={tabScreenOptions}>
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Home', headerShown: false }}
        />
        <Tab.Screen
          name="AllSessions"
          component={AllSessionsScreen}
          options={{ title: 'Sessions', headerShown: false }}
        />
        <Tab.Screen
          name="GroupsList"
          component={GroupsListScreen}
          options={{ title: 'Groups', headerShown: false }}
        />
        <Tab.Screen
          name="Stats"
          component={StatsScreen}
          options={{ title: 'Stats', headerShown: false }}
        />
      </Tab.Navigator>
      <LiveGameBar />
    </View>
  );
}

/** Tabs for guests (no account): local games + auth-gated Groups, local Stats. */
function GuestTabNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator screenOptions={tabScreenOptions}>
        <Tab.Screen
          name="Home"
          component={GuestHomeScreen}
          options={{ title: 'Home', headerShown: false }}
        />
        <Tab.Screen
          name="AllSessions"
          component={LocalSessionsScreen}
          options={{ title: 'Sessions', headerShown: false }}
        />
        <Tab.Screen
          name="GroupsList"
          component={GroupsAuthGateScreen}
          options={{ title: 'Groups', headerShown: false }}
        />
        <Tab.Screen
          name="Stats"
          component={GuestStatsScreen}
          options={{ title: 'Stats', headerShown: false }}
        />
      </Tab.Navigator>
      <LiveGameBar />
    </View>
  );
}

type AppNavigatorProps = {
  navigationRef?: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
};

export default function AppNavigator({ navigationRef }: AppNavigatorProps) {
  const { user, isLoading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    storage.getItemAsync('hasSeenOnboarding').then((val) => {
      setHasSeenOnboarding(!!val);
    });
  }, []);

  // A guest who opened an invite link gets sent to Login; once they sign in,
  // continue the join they started. Fires only on the null → user transition.
  const prevUserRef = useRef<typeof user>(user);
  useEffect(() => {
    const wasGuest = prevUserRef.current === null;
    prevUserRef.current = user;
    if (!wasGuest || user === null) return;
    consumePendingInvite().then(invite => {
      if (!invite) return;
      const navigate = () => {
        const nav = navigationRef?.current;
        if (nav?.isReady()) {
          if (invite.type === 'session') {
            nav.navigate('JoinSession', { inviteToken: invite.token });
          } else {
            nav.navigate('JoinGroup', { inviteToken: invite.token });
          }
        } else {
          setTimeout(navigate, 150);
        }
      };
      // Give the authed tree a beat to mount after the swap.
      setTimeout(navigate, 300);
    });
  }, [user, navigationRef]);

  if (isLoading || hasSeenOnboarding === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Toast />
      <PushListeners />
      <Stack.Navigator screenOptions={stackScreenOptions}>
        {user === null ? (
          // Guest tree — the app is fully usable without an account: local games
          // run on-device; Groups/Stats upsell sign-in; Login is a modal, not a wall.
          <>
            {!hasSeenOnboarding && (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false, gestureEnabled: false }} />
            )}
            <Stack.Screen name="MainTabs" component={GuestTabNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="LocalNewGame"        component={LocalNewGameScreen}        options={{ headerShown: false }} />
            <Stack.Screen name="LocalSession"        component={LocalSessionScreen}        options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="LocalSessionSummary" component={LocalSessionSummaryScreen} options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="Login"    component={LoginScreen}    options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="JoinSession" component={JoinSessionScreen} options={{ headerShown: false }} />
            <Stack.Screen name="JoinGroup"   component={JoinGroupScreen}   options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs"      component={TabNavigator}          options={{ headerShown: false }} />
            <Stack.Screen name="CreateGroup"   component={CreateGroupScreen}     options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="GroupDetail"   component={GroupDetailScreen}     options={{ headerShown: false }} />
            <Stack.Screen name="Invitations"   component={InvitationsScreen}     options={{ title: 'Invitations', headerShown: false }} />
            <Stack.Screen name="EditGroup"     component={EditGroupScreen}       options={{ presentation: 'modal', title: 'Edit Group', headerShown: false }} />
            <Stack.Screen name="SessionsList"  component={SessionsListScreen}    options={{ headerShown: false }} />
            <Stack.Screen name="Session"       component={SessionScreen}         options={{ headerShown: false }} />
            <Stack.Screen name="Profile"       component={ProfileScreen}         options={{ title: 'My Profile', headerShown: false }} />
            <Stack.Screen name="NewGame"            component={NewGameScreen}            options={{ headerShown: false }} />
            <Stack.Screen name="PendingSettlements" component={PendingSettlementsScreen}  options={{ title: 'Pending Settlements', headerShown: false }} />
            <Stack.Screen name="JoinSession"        component={JoinSessionScreen}         options={{ title: 'Joining Session', headerShown: false }} />
            <Stack.Screen name="JoinGroup"          component={JoinGroupScreen}           options={{ title: 'Joining Group', headerShown: false }} />
            <Stack.Screen name="PlayerProfile"      component={PlayerProfileScreen}       options={{ title: 'Player Profile', headerShown: false }} />
            <Stack.Screen name="Notifications"      component={NotificationsScreen}        options={{ headerShown: false }} />
            <Stack.Screen name="LocalNewGame"        component={LocalNewGameScreen}        options={{ headerShown: false }} />
            <Stack.Screen name="LocalSession"        component={LocalSessionScreen}        options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="LocalSessionSummary" component={LocalSessionSummaryScreen} options={{ headerShown: false, gestureEnabled: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const liveBarStyles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    shadowColor: colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  dotWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },
  textGroup: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  sub: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
});
