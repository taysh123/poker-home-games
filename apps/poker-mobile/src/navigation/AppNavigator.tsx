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
import InvitationsScreen from '../screens/InvitationsScreen';
import EditGroupScreen from '../screens/EditGroupScreen';
import SessionsListScreen from '../screens/SessionsListScreen';
import CreateSessionScreen from '../screens/CreateSessionScreen';
import SessionScreen from '../screens/SessionScreen';
import SettlementScreen from '../screens/SettlementScreen';
import StatsScreen from '../screens/StatsScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  GroupsList: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string; groupName: string };
  Invitations: undefined;
  EditGroup: { groupId: string; groupName: string; description?: string };
  SessionsList: { groupId: string; groupName: string; userRole: string };
  CreateSession: { groupId: string; groupName: string };
  Session: { sessionId: string; groupId: string };
  Settlement: { sessionId: string; sessionName: string };
  Stats: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
      <Stack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        {user === null ? (
          <>
            <Stack.Screen name="Login"    component={LoginScreen}    options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GroupsList" component={GroupsListScreen} />
            <Stack.Screen
              name="CreateGroup"
              component={CreateGroupScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
            <Stack.Screen
              name="Invitations"
              component={InvitationsScreen}
              options={{ title: 'Invitations' }}
            />
            <Stack.Screen
              name="EditGroup"
              component={EditGroupScreen}
              options={{ presentation: 'modal', title: 'Edit Group' }}
            />
            <Stack.Screen name="SessionsList" component={SessionsListScreen} />
            <Stack.Screen
              name="CreateSession"
              component={CreateSessionScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="Session"
              component={SessionScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settlement"
              component={SettlementScreen}
              options={{ headerShown: true, title: 'Settle Up', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="Stats"
              component={StatsScreen}
              options={{ headerShown: true, title: 'My Stats', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'My Profile' }}
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
