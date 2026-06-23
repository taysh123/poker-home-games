import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../../../components/Screen';
import ScreenHeader from '../../../components/ScreenHeader';
import Chip from '../../../components/Chip';
import DetailSheet from '../../../components/DetailSheet';
import SplitPane from '../../../components/SplitPane';
import PressableScale from '../../../components/motion/PressableScale';
import { useResponsive } from '../../../hooks/useResponsive';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import type { PreflopRange } from '../../study/types';
import { buildInspectorView } from '../logic/inspector';
import type { SolverRange, VerificationTier } from '../pack/types';
import RangeGrid from './RangeGrid';
import { InspectorBody } from './HandInspector';
import { SolverProvider, useSolver } from '../state/SolverContext';

interface RangeSource {
  id: string;
  label: string;
  tier: VerificationTier;
  range: PreflopRange | SolverRange;
}

function WorkspaceInner() {
  const { isMobile } = useResponsive();
  const { packs, illustrativeRanges, isLoaded, savedSpots, saveSpot } = useSolver();

  const sources = useMemo<RangeSource[]>(() => {
    const list: RangeSource[] = [];
    packs.forEach(p =>
      p.ranges.forEach(r =>
        list.push({ id: `${p.manifest.id}:${r.id}`, label: `${p.manifest.name} · ${r.label}`, tier: r.verificationTier ?? p.manifest.verificationTier, range: r }),
      ),
    );
    illustrativeRanges.forEach(r => list.push({ id: `illustrative:${r.id}`, label: r.label, tier: 'illustrative', range: r }));
    return list;
  }, [packs, illustrativeRanges]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [hand, setHand] = useState<string | undefined>();
  const [sheetOpen, setSheetOpen] = useState(false);

  const active = sources.find(s => s.id === selectedId) ?? sources[0];
  const compare = sources.find(s => s.id === compareId);

  if (!active) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{isLoaded ? 'No ranges yet. Import a solver pack to begin.' : 'Loading…'}</Text>
      </View>
    );
  }

  const onSelectHand = useCallback((h: string) => {
    setHand(h);
    if (isMobile) setSheetOpen(true);
  }, [isMobile]);

  const view = hand ? buildInspectorView(active.range, hand, { tier: active.tier, compareTo: compare?.range }) : null;

  const picker = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picker} contentContainerStyle={styles.pickerRow}>
      {sources.map(s => (
        <PressableScale key={s.id} onPress={() => { setSelectedId(s.id); setHand(undefined); }}>
          <Chip label={s.label} tone={s.id === active.id ? 'gold' : 'neutral'} size="sm" />
        </PressableScale>
      ))}
    </ScrollView>
  );

  const comparePicker = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
      <PressableScale onPress={() => setCompareId(null)}>
        <Chip label="Compare: off" tone={compareId ? 'neutral' : 'info'} size="sm" />
      </PressableScale>
      {sources.filter(s => s.id !== active.id).map(s => (
        <PressableScale key={`cmp-${s.id}`} onPress={() => setCompareId(s.id)}>
          <Chip label={s.label} tone={s.id === compareId ? 'info' : 'neutral'} size="sm" />
        </PressableScale>
      ))}
    </ScrollView>
  );

  const grid = (
    <View>
      {picker}
      {comparePicker}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScroll}>
        <RangeGrid range={active.range} tier={active.tier} selectedHand={hand} compareTo={compare?.range} onSelectHand={onSelectHand} />
      </ScrollView>
    </View>
  );

  const inspector = (
    <View style={styles.inspector}>
      {view ? <InspectorBody view={view} /> : <Text style={styles.muted}>Hover a hand (tap on mobile) to inspect.</Text>}
      {view ? (
        <PressableScale
          onPress={() => saveSpot({ rangeId: active.range.id, rangeLabel: active.label, hand: view.hand })}
          style={styles.saveBtn}
          haptic="light"
        >
          <Text style={styles.saveText}>★ Save spot</Text>
        </PressableScale>
      ) : null}
      {savedSpots.length ? <Text style={styles.savedCount}>{savedSpots.length} saved spot{savedSpots.length === 1 ? '' : 's'}</Text> : null}
    </View>
  );

  return (
    <View style={styles.body}>
      {isMobile ? grid : <SplitPane primary={grid} secondary={inspector} />}
      <DetailSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        {inspector}
      </DetailSheet>
    </View>
  );
}

export default function SolverWorkspaceScreen({ navigation }: { navigation?: { goBack?: () => void } }) {
  return (
    <Screen>
      <ScreenHeader title="Solver" subtitle="Range workspace" onBack={navigation?.goBack} />
      <SolverProvider>
        <WorkspaceInner />
      </SolverProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: 14 },
  picker: { marginBottom: spacing.sm },
  pickerRow: { gap: spacing.sm, paddingVertical: 4 },
  gridScroll: { marginTop: spacing.sm },
  inspector: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.lg, gap: spacing.sm },
  saveBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.gold },
  saveText: { color: colors.gold, fontWeight: '700', fontSize: 13 },
  savedCount: { color: colors.textMuted, fontSize: 12 },
});
