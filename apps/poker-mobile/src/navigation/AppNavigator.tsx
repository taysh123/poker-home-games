import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Animated } from 'react-native';
import { NavigationContainer, NavigationContainerRef, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useActiveSession } from '../context/ActiveSessionContext';
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const translateY = React.useRef(new Animated.Value(80)).current;
  const prevHasSession = React.useRef(false);

  React.useEffect(() => {
    const hasSession = activeSession != null;
    if (hasSession !== prevHasSession.current) {
      prevHasSession.current = hasSession;
      Animated.spring(translateY, {
        toValue: hasSession ? 0 : 80,
        friction: 10,
        tension: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [activeSession]);

  // Pulse animation for the dot
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!activeSession) return null;

  return (
    <Animated.View
      style={[
        liveBarStyles.barWrap,
        { bottom: TAB_BAR_HEIGHT + insets.bottom + 8, transform: [{ translateY }] },
      ]}
    >
      <TouchableOpacity
        style={liveBarStyles.bar}
        onPress={() => navigation.navigate('Session', {
          sessionId: activeSession.sessionId,
          groupId: activeSession.groupId ?? '',
        })}
        activeOpacity={0.9}
      >
        <View style={liveBarStyles.dotWrapper}>
          <Animated.View style={[liveBarStyles.dot, { opacity: pulseAnim }]} />
        </View>
        <View style={liveBarStyles.textGroup}>
          <Text style={liveBarStyles.title} numberOfLines={1}>{activeSession.sessionName}</Text>
          <Text style={liveBarStyles.sub}>Live game · tap to return</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.gold} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function TabNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => {
          const icons: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
            Home:        { active: 'home',      inactive: 'home-outline' },
            AllSessions: { active: 'card',      inactive: 'card-outline' },
            GroupsList:  { active: 'people',    inactive: 'people-outline' },
            Stats:       { active: 'bar-chart', inactive: 'bar-chart-outline' },
          };
          return {
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: TAB_BAR_HEIGHT + (Platform.OS === 'ios' ? 0 : 8),
              paddingBottom: Platform.OS === 'ios' ? 0 : 4,
              paddingTop: 4,
            },
            tabBarActiveTintColor: colors.gold,
            tabBarInactiveTintColor: colors.textDim,
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '600' as const,
              letterSpacing: 0.3,
              marginTop: 2,
            },
            tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
              const pair = icons[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
              return <Ionicons name={focused ? pair.active : pair.inactive} size={size - 2} color={color} />;
            },
          };
        }}
      >
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
          options={{
            title: 'Groups',
            headerShown: true,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
          }}
        />
        <Tab.Screen
          name="Stats"
          component={StatsScreen}
          options={{
            title: 'Stats',
            headerShown: true,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
          }}
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

  if (isLoading || hasSeenOnboarding === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Toast />
      <Stack.Navigator screenOptions={stackScreenOptions}>
        {user === null ? (
          <>
            {!hasSeenOnboarding && (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false, gestureEnabled: false }} />
            )}
            <Stack.Screen name="Login"    component={LoginScreen}    options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs"      component={TabNavigator}          options={{ headerShown: false }} />
            <Stack.Screen name="CreateGroup"   component={CreateGroupScreen}     options={{ presentation: 'modal' }} />
            <Stack.Screen name="GroupDetail"   component={GroupDetailScreen} />
            <Stack.Screen name="Invitations"   component={InvitationsScreen}     options={{ title: 'Invitations' }} />
            <Stack.Screen name="EditGroup"     component={EditGroupScreen}       options={{ presentation: 'modal', title: 'Edit Group' }} />
            <Stack.Screen name="SessionsList"  component={SessionsListScreen} />
            <Stack.Screen name="Session"       component={SessionScreen}         options={{ headerShown: false }} />
            <Stack.Screen name="Profile"       component={ProfileScreen}         options={{ title: 'My Profile' }} />
            <Stack.Screen name="NewGame"            component={NewGameScreen}            options={{ headerShown: false }} />
            <Stack.Screen name="PendingSettlements" component={PendingSettlementsScreen}  options={{ title: 'Pending Settlements' }} />
            <Stack.Screen name="JoinSession"        component={JoinSessionScreen}         options={{ title: 'Joining Session', headerShown: false }} />
            <Stack.Screen name="JoinGroup"          component={JoinGroupScreen}           options={{ title: 'Joining Group', headerShown: false }} />
            <Stack.Screen name="PlayerProfile"      component={PlayerProfileScreen}       options={{ title: 'Player Profile' }} />
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
