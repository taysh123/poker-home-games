import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatPL } from '../utils/formatters';
import { groupMetaLine, groupRowLabel } from '../utils/groupRow';
import Avatar from './Avatar';
import Chip from './Chip';
import PressableScale from './motion/PressableScale';

type Props = {
  name: string;
  memberCount: number;
  role?: string;
  myGroupPL?: number | null;
  myGroupSessions?: number;
  onPress: () => void;
  isFirst?: boolean;
};

export default function GroupListItem({ name, memberCount, role, myGroupPL, myGroupSessions, onPress, isFirst }: Props) {
  const isOwner = role === 'Owner';
  const isAdmin = role === 'Admin';
  // Shared with the hand-rolled twin row in GroupsListScreen (utils/groupRow). The two rendered the
  // same facts and described them differently — one announced only "name, N members" — and the
  // plural rule was written twice and disagreed with itself ("1 session" spoken, "1 sessions" shown).
  const metaText = groupMetaLine(memberCount, myGroupSessions);

  return (
    <PressableScale
      style={[styles.row, !isFirst && styles.border]}
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={groupRowLabel({ name, role, memberCount, myGroupSessions, myGroupPL })}
    >
      <Avatar name={name} size={40} style={styles.avatar} />
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {(isOwner || isAdmin) && (
            <Chip label={isOwner ? 'Owner' : 'Admin'} tone={isOwner ? 'gold' : 'neutral'} />
          )}
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{metaText}</Text>
          {myGroupPL != null && (
            <Text style={[styles.plChip, myGroupPL >= 0 ? styles.plPositive : styles.plNegative]}>
              {formatPL(myGroupPL)}
            </Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} style={styles.chevron} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  border: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  avatar: {
    borderRadius: 12,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: {
    ...typography.label,
    color: colors.text,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  plChip: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  plPositive: { color: colors.success },
  plNegative: { color: colors.error },
  chevron: {
    flexShrink: 0,
  },
});
