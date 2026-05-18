import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.suit}>♠</Text>
      <Text style={styles.title}>T Poker</Text>
      <Text style={styles.subtitle}>Your private poker group manager</Text>
      <ActivityIndicator style={styles.spinner} color={colors.gold} size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  suit: {
    fontSize: 80,
    color: colors.gold,
    marginBottom: 8,
  },
  title: {
    fontSize: 38,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  spinner: {
    marginTop: 40,
  },
});
