import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import PrimaryButton from './PrimaryButton';

type Props = {
  /** Emoji string fallback — ignored when ionicon is provided */
  icon?: string;
  /** Ionicons icon name — renders in a styled circle */
  ionicon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
};

export default function EmptyState({ icon, ionicon, title, subtitle, action }: Props) {
  return (
    <View style={styles.container}>
      {ionicon ? (
        <View style={styles.iconCircle}>
          <Ionicons name={ionicon} size={32} color={colors.textDim} />
        </View>
      ) : icon ? (
        <Text style={styles.emoji}>{icon}</Text>
      ) : null}
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
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emoji: { fontSize: 52, marginBottom: 4 },
  title: { ...typography.h3, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  button: { marginTop: 8 },
});
