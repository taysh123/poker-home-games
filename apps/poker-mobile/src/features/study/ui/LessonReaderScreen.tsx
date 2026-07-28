/**
 * Lesson Reader (PR #3) — renders a module's lesson sections (ordered by SectionOrder) as Markdown.
 * Read-only; reads only via useContent().query → ContentStore (no workbook access). Flag-gated.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import StateView from '../../../components/StateView';
import Markdown from '../../../components/Markdown';
import { MotiView, slideUpSequence, staggerIn } from '../../../components/motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useContent } from '../../../context/ContentContext';
import { useStudy } from '../state/StudyContext';
import { track } from '../../../utils/analytics';
import { sortSections, type LessonSection } from '../logic/lessons';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'LessonReader'>;

export default function LessonReaderScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { moduleId, moduleName } = route.params;
  const { enabled, isLoaded, query } = useContent();
  const { progress, recordLessonCompleted } = useStudy();
  // Read inside the load effect without adding `progress` to its deps (that would re-query
  // content on every answered spot).
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const reduced = useReducedMotion();
  const [sections, setSections] = useState<LessonSection[] | null>(null);
  const [error, setError] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isLoaded || !query) return;
    let cancelled = false;
    setError(false);
    setSections(null);
    query.find('lesson_content', { ModuleID: moduleId })
      .then(rows => {
        if (cancelled) return;
        const secs = sortSections(rows);
        setSections(secs);
        if (secs.length > 0) {
          // Analytics matches the counter: one completion event per module, ever — otherwise the
          // dashboard metric silently diverges from the XP-bearing counter (Q0 find m8).
          if (!progressRef.current.completedLessonIds?.includes(moduleId)) {
            track('study_lesson_completed', { module_id: moduleId });
          }
          // Once per module, ever — re-opens no longer inflate the counter/XP (Q0).
          void recordLessonCompleted(moduleId);
        }
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isLoaded, query, moduleId, reloadKey]);

  const loading = enabled && !error && (!isLoaded || sections === null);

  return (
    <Screen animated>
      <BrandHeader variant="screen" title={moduleName || 'Lesson'} subtitle="Lesson" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StateView
          loading={loading}
          error={error}
          isEmpty={!enabled || !sections || sections.length === 0}
          empty={<EmptyState ionicon="book-outline" title="No lesson content" subtitle="Lessons arrive with the next content update." />}
          onRetry={() => setReloadKey(k => k + 1)}
        >
          {(sections ?? []).map((s, i) => (
            <MotiView key={s.id} {...slideUpSequence({ reduced, delay: staggerIn(i) })}>
              <Card style={styles.section}>
                {s.heading ? <Text style={styles.heading}>{s.heading}</Text> : null}
                <Markdown>{s.body}</Markdown>
              </Card>
            </MotiView>
          ))}
        </StateView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 120, gap: spacing.md },
  section: { gap: spacing.xs },
  heading: { ...typography.h4, color: colors.gold },
});
