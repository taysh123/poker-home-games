import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACTION_META, type PlayerAction } from '../../utils/pokerTable';
import { typography } from '../../theme/typography';
import { radii } from '../../theme/radii';

/**
 * Premium action badge (V2.1 STEP 5.3) — Raise / Call / Check / Fold / All-In with icon + rarity-style
 * tint + glow. Reusable across Study, Decision Trainer, Session Review, Coach examples, future replayers.
 */
export default function ActionBadge({ action }: { action: PlayerAction }) {
  const m = ACTION_META[action];
  return (
    <View
      style={[styles.badge, { borderColor: m.tint + '88', backgroundColor: m.tint + '1A', shadowColor: m.tint }]}
      accessibilityLabel={`Action: ${m.label}`}
    >
      <Ionicons name={m.icon as React.ComponentProps<typeof Ionicons>['name']} size={12} color={m.tint} />
      <Text style={[styles.text, { color: m.tint }]}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  text: { ...typography.caps, fontSize: 10 },
});
