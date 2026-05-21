import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatPL } from '../utils/formatters';

type Props = {
  name: string;
  memberCount: number;
  role?: string;
  myGroupPL?: number | null;
  myGroupSessions?: number;
  onPress: () => void;
  isFirst?: boolean;
};

const AVATAR_COLORS = [
  '#7C6EE8', '#4EAADC', '#50C878', '#E8965E', '#E86E8A',
  '#6EC6E8', '#A8E860', '#E8C45E', '#C46EE8', '#5EC8A0',
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

export default function GroupListItem({ name, memberCount, role, myGroupPL, myGroupSessions, onPress, isFirst }: Props) {
  const bg = avatarColor(name);
  const initial = name[0]?.toUpperCase() ?? '?';
  const isOwner = role === 'Owner';
  const isAdmin = role === 'Admin';

  return (
    <TouchableOpacity
      style={[styles.row, !isFirst && styles.border]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: bg + '22' }]}>
        <Text style={[styles.avatarText, { color: bg }]}>{initial}</Text>
      </View>
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
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
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
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
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
    fontSize: 18,
    color: colors.textDim,
  },
});
