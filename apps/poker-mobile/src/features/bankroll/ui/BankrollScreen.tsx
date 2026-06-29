import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import SectionTitle from '../../../components/SectionTitle';
import PrimaryButton from '../../../components/PrimaryButton';
import EmptyState from '../../../components/EmptyState';
import CrossPillarCTA from '../../../components/CrossPillarCTA';
import { isFeatureEnabled } from '../../../config/features';
import PressableScale from '../../../components/motion/PressableScale';
import AnimatedNumber from '../../../components/motion/AnimatedNumber';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { formatCents, formatCentsSigned } from '../../../utils/money';
import { formatDate } from '../../../utils/formatters';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useBankroll } from '../state/BankrollContext';
import {
  summarize,
  bankrollOverTime,
  sessionNetCents,
  filterSessions,
  type BankrollFilter,
} from '../logic/bankrollAnalytics';
import type { BankrollGameType, BankrollSession } from '../types';
import BankrollChart from './BankrollChart';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TypeFilter = 'all' | BankrollGameType;

const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '' : ''}${v.toFixed(1)}%`);

export default function BankrollScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const navigation = useNavigation<Nav>();
  const { sessions, settings } = useBankroll();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const filter: BankrollFilter = typeFilter === 'all' ? {} : { gameType: typeFilter };
  const filtered = useMemo(() => filterSessions(sessions, filter), [sessions, typeFilter]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const points = useMemo(
    () => bankrollOverTime(filtered, settings.startingBankrollCents),
    [filtered, settings.startingBankrollCents],
  );
  const history = useMemo(
    () => [...filtered].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [filtered],
  );

  const net = summary.totalNetCents;
  const netColor = net > 0 ? colors.success : net < 0 ? colors.error : colors.textHigh;

  const goLog = (sessionId?: string) => navigation.navigate('LogSession', sessionId ? { sessionId } : undefined);

  return (
    <Screen animated>
      {!embedded && (
        <BrandHeader
          variant="brand"
          title="Bankroll"
          right={
            <PressableScale onPress={() => goLog()} haptic="light" style={styles.addBtn}>
              <Ionicons name="add" size={22} color={colors.gold} />
            </PressableScale>
          }
        />
      )}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — total P&L */}
        <Card variant="hero">
          <Text style={styles.heroLabel}>TOTAL PROFIT / LOSS</Text>
          <AnimatedNumber value={net} format={formatCentsSigned} style={[styles.heroAmount, { color: netColor }]} />
          <Text style={styles.heroSub}>
            {summary.sessionCount} session{summary.sessionCount === 1 ? '' : 's'}
            {summary.sessionCount > 0 ? ` · ${summary.winRatePct.toFixed(0)}% winning` : ''}
          </Text>
        </Card>

        {/* Key metrics */}
        <View style={styles.statRow}>
          <Stat label="ROI" value={pct(summary.roiPct)} />
          <Stat label="ABI" value={summary.abiCents === null ? '—' : formatCents(summary.abiCents)} />
          <Stat label="ITM" value={pct(summary.itmPct)} />
        </View>

        {/* Bankroll over time */}
        <View style={styles.section}>
          <SectionTitle>BANKROLL OVER TIME</SectionTitle>
          <Card>
            <BankrollChart points={points} />
            {points.length > 0 ? (
              <Text style={styles.chartFoot}>
                {formatCents(points[points.length - 1].cumulativeCents)} current
              </Text>
            ) : null}
          </Card>
        </View>

        {/* Filter chips */}
        <View style={styles.chips}>
          {(['all', 'cash', 'tournament'] as TypeFilter[]).map(t => (
            <PressableScale
              key={t}
              onPress={() => setTypeFilter(t)}
              haptic="light"
              style={[styles.chip, typeFilter === t && styles.chipActive]}
            >
              <Text style={[styles.chipText, typeFilter === t && styles.chipTextActive]}>
                {t === 'all' ? 'All' : t === 'cash' ? 'Cash' : 'Tournaments'}
              </Text>
            </PressableScale>
          ))}
        </View>

        {/* History */}
        <View style={styles.section}>
          <SectionTitle>SESSION HISTORY</SectionTitle>
          {history.length === 0 ? (
            <EmptyState
              ionicon="receipt-outline"
              title="No sessions yet"
              subtitle="Log your first session to start tracking your bankroll."
              action={{ label: 'Log a Session', onPress: () => goLog() }}
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {history.map(s => (
                <SessionRow key={s.id} session={s} onPress={() => goLog(s.id)} />
              ))}
            </View>
          )}
        </View>

        <PrimaryButton label="Log a Session" variant="gradient" onPress={() => goLog()} />

        {isFeatureEnabled('retention') && isFeatureEnabled('study') && (
          <View style={{ marginTop: spacing.md }}>
            <CrossPillarCTA
              icon="school-outline"
              label="Sharpen up — drill a spot"
              sub="A few preflop reps between sessions"
              onPress={() => navigation.navigate('StudyTrainer', { mode: 'spot' })}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function SessionRow({ session, onPress }: { session: BankrollSession; onPress: () => void }) {
  const net = sessionNetCents(session);
  const netColor = net > 0 ? colors.success : net < 0 ? colors.error : colors.textMuted;
  const isMtt = session.gameType === 'tournament';
  return (
    <PressableScale onPress={onPress} haptic="light">
      <Card padding={spacing.md} style={styles.row}>
        <View style={[styles.typeBadge, isMtt ? styles.badgeMtt : styles.badgeCash]}>
          <Ionicons
            name={isMtt ? 'trophy-outline' : 'cash-outline'}
            size={16}
            color={isMtt ? colors.gold : colors.success}
          />
        </View>
        <View style={styles.rowMid}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {session.venue || (isMtt ? 'Tournament' : 'Cash game')}
          </Text>
          <Text style={styles.rowSub}>
            {formatDate(session.startedAt)}
            {session.source === 'external' ? ' · external' : ''}
          </Text>
        </View>
        <Text style={[styles.rowNet, { color: netColor }]}>{formatCentsSigned(net)}</Text>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 140, gap: spacing.lg },
  addBtn: {
    width: 40, height: 40, borderRadius: radii.pill,
    backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center',
  },
  heroLabel: { ...typography.caps, color: colors.textMuted },
  heroAmount: { ...typography.amountHero, marginTop: spacing.xs },
  heroSub: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.xs },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statValue: { ...typography.amount, color: colors.textHigh },
  statLabel: { ...typography.caps, color: colors.textMuted, marginTop: 2 },
  section: { gap: spacing.sm },
  chartFoot: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'right' },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.goldFaint },
  chipText: { ...typography.labelSmall, color: colors.textMuted },
  chipTextActive: { color: colors.gold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  typeBadge: { width: 36, height: 36, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  badgeMtt: { backgroundColor: colors.goldFaint },
  badgeCash: { backgroundColor: 'rgba(39,174,96,0.10)' },
  rowMid: { flex: 1 },
  rowTitle: { ...typography.label, color: colors.text },
  rowSub: { ...typography.bodySmall, color: colors.textMuted },
  rowNet: { ...typography.amount },
});
