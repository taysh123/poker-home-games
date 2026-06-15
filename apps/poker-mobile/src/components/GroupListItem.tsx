import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatPL } from '../utils/formatters';
import Avatar from './Avatar';
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

  return (
    <PressableScale
      style={[styles.row, !isFirst && styles.border]}
      onPress={onPress}
      haptic="light"
    >
      <Avatar name={name} size={40} style={styles.avatar} />
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {(isOwner || isAdmin) && (
            <View style={[styles.rolePill, isOwner && styles.rolePillOwner]}>
              <Text style={[styles.roleText, isOwner && styles.roleTextOwner]}>
                {isOwner ? 'Owner' : 'Admin'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {memberCount} member{memberCount !== 1 ? 's' : ''}
            {myGroupSessions != null && myGroupSessions > 0 ? ` · ${myGroupSessions} sessions` : ''}
          </Text>
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
  rolePill: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rolePillOwner: {
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  roleTextOwner: {
    color: colors.gold,
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
