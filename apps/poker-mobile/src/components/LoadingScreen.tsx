import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import LottieHost from './motion/LottieHost';

type Props = { message?: string };

export default function LoadingScreen({ message }: Props) {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Loading'}
    >
      <LottieHost
        source={require('../../assets/lottie/loading-chips.json')}
        autoPlay
        loop
        style={styles.lottie}
        poster={<ActivityIndicator color={colors.gold} size="large" />}
      />
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
  lottie: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  message: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
});
