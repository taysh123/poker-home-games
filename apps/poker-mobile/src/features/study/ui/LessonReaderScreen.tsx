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
import SkeletonRow from '../../../components/SkeletonRow';
import Markdown from '../../../components/Markdown';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useContent } from '../../../context/ContentContext';
import { sortSections, type LessonSection } from '../logic/lessons';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'LessonReader'>;

export default function LessonReaderScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { moduleId, moduleName } = route.params;
  const { enabled, isLoaded, query } = useContent();
  const [sections, setSections] = useState<LessonSection[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isLoaded || !query) return;
    let cancelled = false;
    query.find('lesson_content', { ModuleID: moduleId })
      .then(rows => { if (!cancelled) setSections(sortSections(rows)); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isLoaded, query, moduleId]);

  const loading = enabled && !error && (!isLoaded || sections === null);

  return (
    <Screen>
      <BrandHeader variant="screen" title={moduleName || 'Lesson'} subtitle="Lesson" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <EmptyState ionicon="alert-circle-outline" title="Couldn't load this lesson" subtitle="Please try again in a moment." />
        ) : loading ? (
          <>{[0, 1, 2].map(i => <SkeletonRow key={i} isFirst={i === 0} />)}</>
        ) : !enabled || !sections || sections.length === 0 ? (
          <EmptyState ionicon="book-outline" title="No lesson content" subtitle="Lessons arrive with the next content update." />
        ) : (
          sections.map(s => (
            <Card key={s.id} style={styles.section}>
              {s.heading ? <Text style={styles.heading}>{s.heading}</Text> : null}
              <Markdown>{s.body}</Markdown>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 120, gap: spacing.md },
  section: { gap: spacing.xs },
  heading: { ...typography.h4, color: colors.gold },
});
