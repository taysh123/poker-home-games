import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
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
import CreateSessionScreen from '../screens/CreateSessionScreen';
import SessionScreen from '../screens/SessionScreen';
import SettlementScreen from '../screens/SettlementScreen';
import StatsScreen from '../screens/StatsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NewGameScreen from '../screens/NewGameScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  Profile: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string; groupName: string };
  Invitations: undefined;
  EditGroup: { groupId: string; groupName: string; description?: string };
  SessionsList: { groupId: string; groupName: string; userRole: string };
  CreateSession: { groupId: string; groupName: string };
  Session: { sessionId: string; groupId: string };
  Settlement: { sessionId: string; sessionName: string };
  NewGame: { groupId?: string; groupName?: string };
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
  animation: 'fade' as const,
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const },
};

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const icons: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
          Home:        { active: 'home',      inactive: 'home-outline' },
          AllSessions: { active: 'card',      inactive: 'card-outline' },
          GroupsList:  { active: 'people',    inactive: 'people-outline' },
          Stats:       { active: 'bar-chart', inactive: 'bar-chart-outline' },
        };
        return {
          tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
            const pair = icons[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
            return <Ionicons name={focused ? pair.active : pair.inactive} size={size} color={color} />;
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
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          title: 'My Stats',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        {user === null ? (
          <>
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
            <Stack.Screen name="CreateSession" component={CreateSessionScreen}   options={{ presentation: 'modal' }} />
            <Stack.Screen name="Session"       component={SessionScreen}         options={{ headerShown: false }} />
            <Stack.Screen name="Settlement"    component={SettlementScreen}      options={{ title: 'Settle Up' }} />
            <Stack.Screen name="Profile"       component={ProfileScreen}         options={{ title: 'My Profile' }} />
            <Stack.Screen name="NewGame"       component={NewGameScreen}         options={{ headerShown: false }} />
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
