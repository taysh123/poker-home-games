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
import StatWidget from '../../../components/StatWidget';
import Segmented from '../../../components/Segmented';
import { isFeatureEnabled } from '../../../config/features';
import PressableScale from '../../../components/motion/PressableScale';
import AnimatedNumber from '../../../components/motion/AnimatedNumber';
import { MotiView, slideUpSequence } from '../../../components/motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { formatCents, formatCentsSigned } from '../../../utils/money';
import { formatDate, formatMinutes } from '../../../utils/formatters';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useBankroll } from '../state/BankrollContext';
import {
  summarize,
  advancedStats,
  bankrollOverTime,
  sessionNetCents,
  sessionNetHistogram,
  filterSessions,
  type BankrollFilter,
} from '../logic/bankrollAnalytics';
import type { BankrollGameType, BankrollSource, BankrollSession } from '../types';
import BankrollLineChart from './BankrollLineChart';
import BankrollHistogram from './BankrollHistogram';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPE_OPTIONS = ['All', 'Cash', 'Tournaments'];
const TYPE_VALUES: (BankrollGameType | 'all')[] = ['all', 'cash', 'tournament'];
const SOURCE_OPTIONS = ['All sources', 'In app', 'External'];
const SOURCE_VALUES: (BankrollSource | 'all')[] = ['all', 'in_app', 'external'];

const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}%`);
const money = (v: number | null) => (v == null ? '—' : formatCents(v));
const signed = (v: number | null) => (v == null ? '—' : formatCentsSigned(v));
const plColor = (v: number | null) =>
  v == null ? colors.textHigh : v > 0 ? colors.success : v < 0 ? colors.error : colors.textHigh;

export default function BankrollScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const navigation = useNavigation<Nav>();
  const { sessions, settings } = useBankroll();
  const reduced = useReducedMotion();
  const [typeIdx, setTypeIdx] = useState(0);
  const [sourceIdx, setSourceIdx] = useState(0);

  const filter: BankrollFilter = useMemo(() => {
    const f: BankrollFilter = {};
    if (TYPE_VALUES[typeIdx] !== 'all') f.gameType = TYPE_VALUES[typeIdx] as BankrollGameType;
    if (SOURCE_VALUES[sourceIdx] !== 'all') f.source = SOURCE_VALUES[sourceIdx] as BankrollSource;
    return f;
  }, [typeIdx, sourceIdx]);

  const filtered = useMemo(() => filterSessions(sessions, filter), [sessions, filter]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const adv = useMemo(() => advancedStats(filtered), [filtered]);
  const points = useMemo(
    () => bankrollOverTime(filtered, settings.startingBankrollCents),
    [filtered, settings.startingBankrollCents],
  );
  const bins = useMemo(() => sessionNetHistogram(filtered, 7), [filtered]);
  const history = useMemo(
    () => [...filtered].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [filtered],
  );

  const net = summary.totalNetCents;
  const netColor = net > 0 ? colors.success : net < 0 ? colors.error : colors.textHigh;
  const hasSessions = sessions.length > 0;
  const hasFiltered = filtered.length > 0;
  const showHistogram = filtered.length >= 2 && bins.length > 1;

  const winRate = summary.sessionCount > 0 ? `${summary.winRatePct.toFixed(0)}%` : '—';
  const drawdownValue = adv.maxDrawdownCents > 0 ? `−${formatCents(adv.maxDrawdownCents)}` : formatCents(0);

  const goLog = (sessionId?: string) =>
    navigation.navigate('LogSession', sessionId ? { sessionId } : undefined);
  const clearFilters = () => { setTypeIdx(0); setSourceIdx(0); };

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero — total P&L */}
        <Card variant="hero">
          <Text style={styles.heroLabel}>TOTAL PROFIT / LOSS</Text>
          <AnimatedNumber value={net} format={formatCentsSigned} style={[styles.heroAmount, { color: netColor }]} />
          <Text style={styles.heroSub}>
            {summary.sessionCount} session{summary.sessionCount === 1 ? '' : 's'}
            {summary.sessionCount > 0 ? ` · ${summary.winRatePct.toFixed(0)}% winning` : ''}
          </Text>
        </Card>

        {hasSessions && (
          <View style={styles.filters}>
            <Segmented
              options={TYPE_OPTIONS}
              selectedIndex={typeIdx}
              onChange={setTypeIdx}
              accessibilityLabel="Filter by game type"
            />
            <Segmented
              options={SOURCE_OPTIONS}
              selectedIndex={sourceIdx}
              onChange={setSourceIdx}
              accessibilityLabel="Filter by source"
            />
          </View>
        )}

        {!hasSessions ? (
          <EmptyState
            ionicon="receipt-outline"
            title="No sessions yet"
            subtitle="Log your first session to start tracking your bankroll."
            action={{ label: 'Log a Session', onPress: () => goLog() }}
          />
        ) : !hasFiltered ? (
          <EmptyState
            ionicon="filter-outline"
            title="No sessions match"
            subtitle="No sessions for this filter. Try a different game type or source."
            action={{ label: 'Show all', onPress: clearFilters }}
          />
        ) : (
          <>
            {/* Bankroll over time — SVG line chart */}
            <MotiView {...slideUpSequence({ reduced })}>
              <View style={styles.section}>
                <SectionTitle>BANKROLL OVER TIME</SectionTitle>
                <Card>
                  <BankrollLineChart points={points} />
                  {points.length > 0 ? (
                    <Text style={styles.chartFoot}>
                      {formatCents(points[points.length - 1].cumulativeCents)} current
                    </Text>
                  ) : null}
                </Card>
              </View>
            </MotiView>

            {/* Performance metrics */}
            <View style={styles.section}>
              <SectionTitle>PERFORMANCE</SectionTitle>
              <View style={styles.tileRow}>
                <StatWidget label="Win rate" value={winRate} ionicon="trophy-outline" accentColor={colors.gold} delay={0} />
                <StatWidget label="ROI" value={pct(summary.roiPct)} valueColor={plColor(summary.roiPct)} ionicon="trending-up-outline" accentColor={colors.success} delay={40} />
                <StatWidget label="ITM" value={pct(summary.itmPct)} ionicon="ribbon-outline" accentColor={colors.gold} delay={80} />
              </View>
              <View style={styles.tileRow}>
                <StatWidget label="Avg buy-in" value={money(summary.abiCents)} ionicon="pricetag-outline" accentColor={colors.textMuted} delay={120} />
                <StatWidget label="Per hour" value={signed(summary.netPerHourCents)} valueColor={plColor(summary.netPerHourCents)} ionicon="time-outline" accentColor={colors.info} delay={160} />
                <StatWidget label="Time" value={formatMinutes(summary.totalDurationMinutes)} ionicon="hourglass-outline" accentColor={colors.textMuted} delay={200} />
              </View>
            </View>

            {/* Risk & variance — the new advanced metrics */}
            <View style={styles.section}>
              <SectionTitle>RISK & VARIANCE</SectionTitle>
              <View style={styles.tileRow}>
                <StatWidget label="Std dev" value={money(adv.stdDevCents)} sub="per-session swing" ionicon="pulse-outline" accentColor={colors.info} delay={0} />
                <StatWidget label="Max drawdown" value={drawdownValue} valueColor={adv.maxDrawdownCents > 0 ? colors.error : colors.textHigh} sub="peak to trough" ionicon="trending-down-outline" accentColor={colors.error} delay={40} />
              </View>
              <View style={styles.tileRow}>
                <StatWidget label="Best session" value={signed(adv.bestNetCents)} valueColor={plColor(adv.bestNetCents)} ionicon="arrow-up-outline" accentColor={colors.success} delay={80} />
                <StatWidget label="Worst session" value={signed(adv.worstNetCents)} valueColor={plColor(adv.worstNetCents)} ionicon="arrow-down-outline" accentColor={colors.error} delay={120} />
              </View>
            </View>

            {/* Result distribution histogram */}
            {showHistogram && (
              <MotiView {...slideUpSequence({ reduced, delay: 60 })}>
                <View style={styles.section}>
                  <SectionTitle>RESULT DISTRIBUTION</SectionTitle>
                  <Card>
                    <BankrollHistogram bins={bins} />
                    <View style={styles.legend}>
                      <LegendDot color={colors.error} label="Losing" />
                      <LegendDot color={colors.gold} label="Winning" />
                    </View>
                  </Card>
                </View>
              </MotiView>
            )}

            {/* History */}
            <View style={styles.section}>
              <SectionTitle>SESSION HISTORY</SectionTitle>
              <View style={{ gap: spacing.sm }}>
                {history.map(s => (
                  <SessionRow key={s.id} session={s} onPress={() => goLog(s.id)} />
                ))}
              </View>
            </View>
          </>
        )}

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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
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
  filters: { gap: spacing.sm },
  section: { gap: spacing.sm },
  tileRow: { flexDirection: 'row', gap: spacing.sm },
  chartFoot: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'right' },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.caption, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  typeBadge: { width: 36, height: 36, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  badgeMtt: { backgroundColor: colors.goldFaint },
  badgeCash: { backgroundColor: 'rgba(39,174,96,0.10)' },
  rowMid: { flex: 1 },
  rowTitle: { ...typography.label, color: colors.text },
  rowSub: { ...typography.bodySmall, color: colors.textMuted },
  rowNet: { ...typography.amount },
});
