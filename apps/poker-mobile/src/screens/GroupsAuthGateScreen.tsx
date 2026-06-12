import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { RootStackParamList } from '../navigation/AppNavigator';
import EmptyState from '../components/EmptyState';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Groups tab for guests: premium gate explaining what an account unlocks. */
export default function GroupsAuthGateScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Groups</Text>
      <EmptyState
        ionicon="people-outline"
        title="Your club awaits"
        subtitle={
          'Groups are where your poker crew lives — shared sessions, leaderboards, rivalries, and an activity feed.\n\nSign in to create or join a group.'
        }
        action={{ label: 'Sign In', onPress: () => navigation.navigate('Login') }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.text, padding: 20, paddingBottom: 0 },
});
