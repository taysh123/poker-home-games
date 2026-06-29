import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../../theme/colors';

/** Dealer "D" button marker (V2.1 STEP 5.3). */
export default function DealerButton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.btn, style]} accessibilityLabel="Dealer button">
      <Text style={styles.text}>D</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.goldDark,
  },
  text: { fontSize: 11, fontWeight: '800', color: colors.backgroundDeep },
});
