import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import PressableScale from './motion/PressableScale';
import { MotiView, slideUpSequence } from './motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type AccordionItem = { id: string; title: string; body: string };

type Props = {
  items: AccordionItem[];
  /** Open one item on mount (e.g. deep-linked FAQ). */
  initiallyOpenId?: string | null;
};

/**
 * Single-open accordion (FAQ). Web-safe by construction:
 * - Answers mount/unmount (no height animation — the layout-animation web rule);
 *   the entrance is a short opacity/rise via the shared recipe, instant under
 *   OS Reduce Motion.
 * - Headers are real buttons: role, accessible name, expanded state, 44pt target.
 */
export default function Accordion({ items, initiallyOpenId = null }: Props) {
  const [openId, setOpenId] = useState<string | null>(initiallyOpenId);
  const reduced = useReducedMotion();

  return (
    <View style={styles.list}>
      {items.map(item => {
        const open = openId === item.id;
        return (
          <View key={item.id} style={[styles.item, open && styles.itemOpen]}>
            <PressableScale
              style={styles.header}
              onPress={() => setOpenId(open ? null : item.id)}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityState={{ expanded: open }}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={iconSize.sm}
                color={open ? colors.gold : colors.textMuted}
              />
            </PressableScale>
            {open && (
              <MotiView {...slideUpSequence({ reduced, duration: 180, distance: 6 })}>
                <Text style={styles.body}>{item.body}</Text>
              </MotiView>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  item: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
  },
  itemOpen: { borderColor: colors.goldMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  title: { ...typography.h4, color: colors.text, flex: 1 },
  body: {
    ...typography.body,
    color: colors.textMuted,
    paddingBottom: spacing.lg,
  },
});
