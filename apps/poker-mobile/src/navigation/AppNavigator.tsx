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
import { Sora } from '../theme/fonts';
import { useAuth } from '../context/AuthContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useLocalGames } from '../context/LocalGamesContext';
import { consumePendingInvite } from '../utils/pendingInvite';
import { consumePendingCheckout } from '../utils/pendingCheckout';
import LandingScreen from '../screens/LandingScreen';
import { resolveWebLanding } from '../features/landing/landingRouting';
import { initialGuestRoute, logoutResetRoute } from './entryRouting';
import { usePushNotificationListeners } from '../hooks/usePushNotifications';
import { useReducedMotion } from '../hooks/useReducedMotion';
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
import OnboardingV2Screen from '../screens/OnboardingV2Screen';
import PlacementDrillScreen from '../features/persona/ui/PlacementDrillScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
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
import OfflineBanner from '../components/OfflineBanner';
import * as storage from '../utils/storage';
import { isFeatureEnabled } from '../config/features';
import BankrollScreen from '../features/bankroll/ui/BankrollScreen';
import LogSessionScreen from '../features/bankroll/ui/LogSessionScreen';
import StudyScreen from '../features/study/ui/StudyScreen';
import SpotTrainerScreen from '../features/study/ui/SpotTrainerScreen';
import SolverWorkspaceScreen from '../features/solver/ui/SolverWorkspaceScreen';
import LessonModulesScreen from '../features/study/ui/LessonModulesScreen';
import LessonReaderScreen from '../features/study/ui/LessonReaderScreen';
import QuizRunnerScreen from '../features/study/ui/QuizRunnerScreen';
import PackCatalogScreen from '../features/premium/ui/PackCatalogScreen';
import PackDetailScreen from '../features/premium/ui/PackDetailScreen';
import CoachScreen from '../features/coach/ui/CoachScreen';
import CoachInputScreen from '../features/coach/ui/CoachInputScreen';
import CoachResultScreen from '../features/coach/ui/CoachResultScreen';
import CoachGroundingScreen from '../features/coach/ui/CoachGroundingScreen';
import type { CoachInputKind } from '../features/coach/types';
import PaywallScreen from '../features/premium/ui/PaywallScreen';
import TrackScreen from '../screens/TrackScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen';
import CurrencyPickerScreen from '../screens/CurrencyPickerScreen';

type TrackSegment = 'bankroll' | 'sessions' | 'stats';

export type RootStackParamList = {
  Landing: undefined;
  Welcome: { firstRun: boolean } | undefined;
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
  // V2 — Bankroll tracker (Track pillar)
  LogSession: { sessionId?: string } | undefined;
  // V2 — Study (Study pillar)
  StudyTrainer: { mode: 'spot' | 'decision' };
  // Wave 1.3 — retake the setup quiz (same funnel screen, retake mode; BOTH trees)
  PersonaQuiz: undefined;
  // Wave 1.4 — one-time placement drill that calibrates the persona's skill (BOTH trees)
  PlacementDrill: undefined;
  // Web-first flagship — solver workspace (solver flag)
  SolverWorkspace: undefined;
  // V2.2 — Content platform (Lessons; content flag)
  LessonModules: undefined;
  LessonReader: { moduleId: string; moduleName?: string };
  QuizRunner: { quizId?: string; collectionId?: string } | undefined;
  PackCatalog: undefined;
  PackDetail: { packId: string };
  // V2 — AI Coach (Improve pillar)
  CoachInput: { method: CoachInputKind };
  CoachResult: { id: string };
  CoachGrounding: undefined;
  // V2 — Monetization
  Paywall: { trigger?: string } | undefined;
  // V2.1 — Track hub (5-tab IA)
  Track: { segment?: TrackSegment } | undefined;
  // V2.1 STEP 3 — retention
  Achievements: undefined;
  NotificationPreferences: undefined;
  CurrencyPicker: undefined;
  // Kept for TypeScript compat on existing screens that navigate to these by name
  Home: undefined;
  AllSessions: undefined;
  GroupsList: undefined;
  Stats: undefined;
};

export type TabParamList = {
  Home: undefined;
  AllSessions: undefined;
  Bankroll: undefined;
  Track: { segment?: TrackSegment } | undefined;
  Study: undefined;
  Coach: undefined;
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
  prefixes: ['https://app.tpoker.app', 'tpoker://'],
  config: {
    screens: {
      // Site root → Landing for logged-out web visitors. The /join/* paths below are
      // more specific and always win for deep links, so they bypass Landing correctly.
      Landing: '',
      JoinGroup: 'join/group/:inviteToken',
      JoinSession: 'join/session/:inviteToken',
      // Web-first flagship deep link (resolves only when the `solver` flag registers the screen).
      SolverWorkspace: 'solver',
    },
  },
};

const stackScreenOptionsBase = {
  contentStyle: { backgroundColor: colors.background },
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
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(80);
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    translateY.value = withSpring(hasEntry ? 0 : 80, { damping: 18, stiffness: 160 });
  }, [hasEntry, translateY]);

  React.useEffect(() => {
    // Respect OS Reduce Motion — hold the live dot steady instead of the infinite pulse.
    if (reducedMotion) { pulse.value = 1; return; }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
    );
  }, [pulse, reducedMotion]);

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
      <TouchableOpacity
        style={liveBarStyles.bar}
        onPress={entry.onPress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`Return to ${entry.title}`}
      >
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

/**
 * Shared tab styling for both the authed and guest tab navigators.
 * Takes the safe-area bottom inset so the iOS tab bar clears the home indicator
 * (an explicit height/paddingBottom otherwise overrides RN's auto safe-area handling).
 */
function makeTabScreenOptions(bottomInset: number) {
  return function tabScreenOptions({ route }: { route: { name: string } }) {
  const icons: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
    Home:        { active: 'home',      inactive: 'home-outline' },
    AllSessions: { active: 'card',      inactive: 'card-outline' },
    Track:       { active: 'wallet',    inactive: 'wallet-outline' },
    Bankroll:    { active: 'wallet',    inactive: 'wallet-outline' },
    Study:       { active: 'school',    inactive: 'school-outline' },
    Coach:       { active: 'sparkles',  inactive: 'sparkles-outline' },
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
      height: TAB_BAR_HEIGHT + (Platform.OS === 'ios' ? bottomInset : 8),
      paddingBottom: Platform.OS === 'ios' ? bottomInset : 4,
      paddingTop: 4,
    },
    ...(Platform.OS === 'ios'
      ? { tabBarBackground: () => <GlassView style={StyleSheet.absoluteFill} /> }
      : null),
    tabBarActiveTintColor: colors.gold,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarLabelStyle: {
      fontSize: 10,
      // The tab bar label renders through React Navigation's own text path,
      // which the global font patch doesn't reliably reach on web — set the
      // family explicitly. Sora is the UI-chrome face.
      fontFamily: Sora['600'],
      letterSpacing: 0.3,
      marginTop: 2,
    },
    tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
      const pair = icons[route.name] ?? { active: 'ellipse' as IoniconsName, inactive: 'ellipse-outline' as IoniconsName };
      return <TabIcon name={focused ? pair.active : pair.inactive} size={size - 2} color={color} focused={focused} />;
    },
  };
  };
}

function TabNavigator() {
  const insets = useSafeAreaInsets();
  const nav5 = isFeatureEnabled('nav5');
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator screenOptions={makeTabScreenOptions(insets.bottom)}>
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Home', headerShown: false }}
        />
        {nav5 ? (
          <Tab.Screen
            name="Track"
            component={TrackScreen}
            options={{ title: 'Track', headerShown: false }}
          />
        ) : (
          <Tab.Screen
            name="AllSessions"
            component={AllSessionsScreen}
            options={{ title: 'Sessions', headerShown: false }}
          />
        )}
        {!nav5 && isFeatureEnabled('bankroll') && (
          <Tab.Screen
            name="Bankroll"
            component={BankrollScreen}
            options={{ title: 'Bankroll', headerShown: false }}
          />
        )}
        {isFeatureEnabled('study') && (
          <Tab.Screen
            name="Study"
            component={StudyScreen}
            options={{ title: 'Study', headerShown: false }}
          />
        )}
        {isFeatureEnabled('coach') && (
          <Tab.Screen
            name="Coach"
            component={CoachScreen}
            options={{ title: 'Coach', headerShown: false }}
          />
        )}
        <Tab.Screen
          name="GroupsList"
          component={GroupsListScreen}
          options={{ title: 'Groups', headerShown: false }}
        />
        {!nav5 && (
          <Tab.Screen
            name="Stats"
            component={StatsScreen}
            options={{ title: 'Stats', headerShown: false }}
          />
        )}
      </Tab.Navigator>
      <LiveGameBar />
    </View>
  );
}

/** Tabs for guests (no account): local games + auth-gated Groups, local Stats. */
function GuestTabNavigator() {
  const insets = useSafeAreaInsets();
  const nav5 = isFeatureEnabled('nav5');
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator screenOptions={makeTabScreenOptions(insets.bottom)}>
        <Tab.Screen
          name="Home"
          component={GuestHomeScreen}
          options={{ title: 'Home', headerShown: false }}
        />
        {nav5 ? (
          <Tab.Screen
            name="Track"
            component={TrackScreen}
            options={{ title: 'Track', headerShown: false }}
          />
        ) : (
          <Tab.Screen
            name="AllSessions"
            component={LocalSessionsScreen}
            options={{ title: 'Sessions', headerShown: false }}
          />
        )}
        {!nav5 && isFeatureEnabled('bankroll') && (
          <Tab.Screen
            name="Bankroll"
            component={BankrollScreen}
            options={{ title: 'Bankroll', headerShown: false }}
          />
        )}
        {isFeatureEnabled('study') && (
          <Tab.Screen
            name="Study"
            component={StudyScreen}
            options={{ title: 'Study', headerShown: false }}
          />
        )}
        {isFeatureEnabled('coach') && (
          <Tab.Screen
            name="Coach"
            component={CoachScreen}
            options={{ title: 'Coach', headerShown: false }}
          />
        )}
        <Tab.Screen
          name="GroupsList"
          component={GroupsAuthGateScreen}
          options={{ title: 'Groups', headerShown: false }}
        />
        {!nav5 && (
          <Tab.Screen
            name="Stats"
            component={GuestStatsScreen}
            options={{ title: 'Stats', headerShown: false }}
          />
        )}
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
  const reducedMotion = useReducedMotion();
  const stackScreenOptions = {
    ...stackScreenOptionsBase,
    animation: reducedMotion ? ('none' as const) : ('slide_from_right' as const),
    animationDuration: reducedMotion ? 0 : 350,
  };

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

    // Resume a pending checkout intent (from LandingScreen pricing CTA → Register flow).
    // Route to Paywall so the freshly-authed user can complete their purchase there.
    consumePendingCheckout().then(plan => {
      if (!plan) return;
      const go = () => {
        const nav = navigationRef?.current;
        if (nav?.isReady()) {
          nav.navigate('Paywall', { trigger: `landing_${plan}` });
        } else {
          setTimeout(go, 150);
        }
      };
      setTimeout(go, 300);
    });
  }, [user, navigationRef]);

  // Decide whether to show the web landing page (logged-out web visitors at root only).
  // Gated behind the `paywall` flag so the premium launch (paywall + this pricing landing) lights up
  // as ONE flag flip — until then, logged-out web keeps the current guest experience (no surprise on merge).
  const showLanding = isFeatureEnabled('paywall') && resolveWebLanding({
    platform: Platform.OS as 'web' | 'ios' | 'android',
    isAuthed: user !== null,
    path:
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.pathname
        : '/',
  });

  // Scope update B: logout lands on the explicit Welcome chooser, not silently on
  // guest Home. Both trees register MainTabs, so it SURVIVES the authed → guest tree
  // swap and initialRouteName never re-applies — an explicit reset is the only way.
  const wasAuthedRef = useRef<boolean>(user !== null);
  useEffect(() => {
    const wasAuthed = wasAuthedRef.current;
    wasAuthedRef.current = user !== null;
    if (!wasAuthed || user !== null || hasSeenOnboarding === undefined) return;
    const target = logoutResetRoute({
      showLanding,
      welcomeEnabled: isFeatureEnabled('welcome'),
      hasSeenOnboarding,
    });
    if (!target) return;
    const reset = () => {
      const nav = navigationRef?.current;
      if (nav?.isReady()) {
        nav.reset({ index: 0, routes: [target] });
      } else {
        setTimeout(reset, 150);
      }
    };
    reset();
  }, [user, navigationRef, showLanding, hasSeenOnboarding]);

  if (isLoading || hasSeenOnboarding === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  // Signed-out entry (scope: entry choice) — the pure spec in entryRouting.ts decides
  // where the guest tree opens: Landing (web root) → Welcome chooser → legacy fallback.
  const guestInitialRoute = initialGuestRoute({
    showLanding,
    welcomeEnabled: isFeatureEnabled('welcome'),
    hasSeenOnboarding,
  });

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Toast />
      <OfflineBanner />
      <PushListeners />
      <Stack.Navigator
        screenOptions={stackScreenOptions}
        initialRouteName={user === null ? guestInitialRoute : 'MainTabs'}
      >
        {user === null ? (
          // Guest tree — the app is fully usable without an account: local games
          // run on-device; Groups/Stats upsell sign-in; Login is a modal, not a wall.
          <>
            {showLanding && (
              <Stack.Screen
                name="Landing"
                component={LandingScreen}
                options={{ headerShown: false }}
              />
            )}
            {isFeatureEnabled('welcome') && (
              <Stack.Screen
                name="Welcome"
                component={WelcomeScreen}
                initialParams={{ firstRun: !hasSeenOnboarding }}
                options={{ headerShown: false, gestureEnabled: false }}
              />
            )}
            {!hasSeenOnboarding && (
              <Stack.Screen
                name="Onboarding"
                component={isFeatureEnabled('onboardingV2') ? OnboardingV2Screen : OnboardingScreen}
                options={{ headerShown: false, gestureEnabled: false }}
              />
            )}
            <Stack.Screen name="MainTabs" component={GuestTabNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="LocalNewGame"        component={LocalNewGameScreen}        options={{ headerShown: false }} />
            <Stack.Screen name="LocalSession"        component={LocalSessionScreen}        options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="LocalSessionSummary" component={LocalSessionSummaryScreen} options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="LogSession" component={LogSessionScreen} options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="StudyTrainer" component={SpotTrainerScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PersonaQuiz" component={OnboardingV2Screen} options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="PlacementDrill" component={PlacementDrillScreen} options={{ headerShown: false }} />
            {isFeatureEnabled('solver') && (
              <Stack.Screen name="SolverWorkspace" component={SolverWorkspaceScreen} options={{ headerShown: false }} />
            )}
            <Stack.Screen name="LessonModules" component={LessonModulesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="LessonReader" component={LessonReaderScreen} options={{ headerShown: false }} />
            <Stack.Screen name="QuizRunner" component={QuizRunnerScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PackCatalog" component={PackCatalogScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PackDetail" component={PackDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CoachInput"  component={CoachInputScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="CoachResult" component={CoachResultScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CoachGrounding" component={CoachGroundingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Paywall"     component={PaywallScreen}     options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CurrencyPicker" component={CurrencyPickerScreen} options={{ headerShown: false }} />
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
            <Stack.Screen name="LogSession" component={LogSessionScreen} options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="StudyTrainer" component={SpotTrainerScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PersonaQuiz" component={OnboardingV2Screen} options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="PlacementDrill" component={PlacementDrillScreen} options={{ headerShown: false }} />
            {isFeatureEnabled('solver') && (
              <Stack.Screen name="SolverWorkspace" component={SolverWorkspaceScreen} options={{ headerShown: false }} />
            )}
            <Stack.Screen name="LessonModules" component={LessonModulesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="LessonReader" component={LessonReaderScreen} options={{ headerShown: false }} />
            <Stack.Screen name="QuizRunner" component={QuizRunnerScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PackCatalog" component={PackCatalogScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PackDetail" component={PackDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CoachInput"  component={CoachInputScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="CoachResult" component={CoachResultScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CoachGrounding" component={CoachGroundingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Paywall"     component={PaywallScreen}     options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CurrencyPicker" component={CurrencyPickerScreen} options={{ headerShown: false }} />
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
