import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import PrimaryButton from './PrimaryButton';

type Props = {
  icon: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
};

export default function EmptyState({ icon, title, subtitle, action }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? (
        <PrimaryButton
          label={action.label}
          onPress={action.onPress}
          variant="outline"
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  icon: { fontSize: 52, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  button: { marginTop: 8 },
});
