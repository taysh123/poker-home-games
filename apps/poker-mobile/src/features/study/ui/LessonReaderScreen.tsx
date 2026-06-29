/**
 * Lesson Reader (PR #3) — renders a module's lesson sections (ordered by SectionOrder) as Markdown.
 * Read-only; reads only via useContent().query → ContentStore (no workbook access). Flag-gated.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import StateView from '../../../components/StateView';
import Markdown from '../../../components/Markdown';
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
  const { recordLessonCompleted } = useStudy();
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
          track('study_lesson_completed', { module_id: moduleId });
          void recordLessonCompleted();
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
          {(sections ?? []).map(s => (
            <Card key={s.id} style={styles.section}>
              {s.heading ? <Text style={styles.heading}>{s.heading}</Text> : null}
              <Markdown>{s.body}</Markdown>
            </Card>
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
