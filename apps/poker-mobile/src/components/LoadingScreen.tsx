import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = { message?: string };

export default function LoadingScreen({ message }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.gold} size="large" />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  message: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
});
