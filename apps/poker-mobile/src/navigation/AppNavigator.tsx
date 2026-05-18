import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import GroupsListScreen from '../screens/GroupsListScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import SessionsListScreen from '../screens/SessionsListScreen';
import CreateSessionScreen from '../screens/CreateSessionScreen';
import SessionDetailScreen from '../screens/SessionDetailScreen';
import SettlementScreen from '../screens/SettlementScreen';
import SessionSummaryScreen from '../screens/SessionSummaryScreen';

// All possible route names and their params
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  GroupsList: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string; groupName: string };
  SessionsList: { groupId: string; groupName: string; userRole: string };
  CreateSession: { groupId: string; groupName: string };
  SessionDetail: { sessionId: string; sessionName: string; userRole: string };
  Settlement: { sessionId: string; sessionName: string };
  SessionSummary: { sessionId: string; sessionName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { user, isLoading } = useAuth();

  // While AuthContext is reading from secure storage, show a simple loading screen.
  // This prevents a flash of the Login screen before the saved session is restored.
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        {user === null ? (
          // Not logged in → show auth screens
          // When login/register succeeds, user becomes non-null and these screens
          // are replaced by the app screens automatically — no navigation.replace() needed.
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          // Logged in → show app screens
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="GroupsList" component={GroupsListScreen} />
            <Stack.Screen
              name="CreateGroup"
              component={CreateGroupScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
            <Stack.Screen name="SessionsList" component={SessionsListScreen} />
            <Stack.Screen
              name="CreateSession"
              component={CreateSessionScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
            <Stack.Screen
              name="Settlement"
              component={SettlementScreen}
              options={{ headerShown: true, title: 'Settle Up', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="SessionSummary"
              component={SessionSummaryScreen}
              options={{ headerShown: true, title: 'Session Summary', headerBackTitle: 'Back' }}
            />
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
