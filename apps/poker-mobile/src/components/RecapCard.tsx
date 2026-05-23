import React, { useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { USE_NATIVE_DRIVER } from '../theme/motion';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import SkeletonCard from './SkeletonCard';
import { SessionRecapDto } from '../api/sessionsApi';

type Props = {
  recap: SessionRecapDto | null;
  loading: boolean;
  onShare: () => void;
  sharing: boolean;
};

function fmtMoney(n: number): string {
  const abs = Math.abs(Math.round(n));
  return n >= 0 ? `₪${abs.toLocaleString()}` : `-₪${abs.toLocaleString()}`;
}

export default function RecapCard({ recap, loading, onShare, sharing }: Props) {
  const [expanded, setExpanded] = useState(true);
  const chevronAnim = useRef(new Animated.Value(1)).current;

  const toggle = () => {
    const next = !expanded;
    Animated.timing(chevronAnim, {
      toValue: next ? 1 : 0,
      duration: 220,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    setExpanded(next);
  };

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  if (loading) {
    return <SkeletonCard height={156} style={styles.skeleton} />;
  }
  if (!recap) return null;

  const hasHighlights = recap.highlights.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.accent} />
      <View style={styles.inner}>

        {/* Header */}
        <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.7}>
          <View style={styles.headerLeft}>
            <Ionicons name="trophy" size={14} color={colors.gold} />
            <Text style={styles.headerTitle}>SESSION RECAP</Text>
          </View>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <Ionicons name="chevron-up" size={16} color={colors.textMuted} />
          </Animated.View>
        </TouchableOpacity>

        {/* Stats row — always visible */}
        <View style={styles.statsRow}>
          {recap.duration ? (
            <StatChip label="Duration" value={recap.duration} />
          ) : null}
          <StatChip label="Total Pot" value={fmtMoney(recap.totalPot)} gold />
          <StatChip label="Players" value={String(recap.playerCount)} />
          {recap.handCount > 0 ? (
            <StatChip label="Hands" value={String(recap.handCount)} />
          ) : null}
        </View>

        {/* Expandable body */}
        {expanded && (
          <>
            {hasHighlights && (
              <>
                <View style={styles.divider} />
                <View style={styles.highlights}>
                  {recap.highlights.map((h, i) => (
                    <View key={i} style={styles.highlightRow}>
                      <View style={styles.bullet} />
                      <Text style={styles.highlightText}>{h}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={onShare}
                disabled={sharing}
                activeOpacity={0.8}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <>
                    <Ionicons name="share-outline" size={13} color={colors.gold} />
                    <Text style={styles.shareBtnText}>Share Recap</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

      </View>
    </View>
  );
}

function StatChip({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <View style={styles.statChip}>
      <Text style={[styles.statValue, gold && styles.statValueGold]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accent: {
    width: 3,
    backgroundColor: colors.gold,
    flexShrink: 0,
  },
  inner: {
    flex: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    ...typography.caps,
    color: colors.textMuted,
    letterSpacing: 1.0,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceHigh,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 3,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text,
  },
  statValueGold: {
    color: colors.goldLight,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  highlights: {
    gap: 7,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.goldMuted,
    marginTop: 7,
    flexShrink: 0,
  },
  highlightText: {
    ...typography.bodySmall,
    color: colors.textHigh,
    flex: 1,
  },
  footer: {
    marginTop: 14,
    alignItems: 'flex-end',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.gold,
  },
});
