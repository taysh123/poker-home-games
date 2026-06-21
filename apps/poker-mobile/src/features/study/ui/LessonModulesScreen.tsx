/**
 * Lesson Modules (PR #3) — lists learning modules from the ContentStore (read-only, via useContent().query;
 * never the workbook). Flag-gated (`content`); honest empty state until real content lands. UI uses the
 * design-system primitives (StateView / ListRow).
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import EmptyState from '../../../components/EmptyState';
import StateView from '../../../components/StateView';
import ListRow from '../../../components/ListRow';
import { spacing } from '../../../theme/spacing';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useContent } from '../../../context/ContentContext';
import { toModules, type LessonModule } from '../logic/lessons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LessonModulesScreen() {
  const navigation = useNavigation<Nav>();
  const { enabled, isLoaded, query } = useContent();
  const [modules, setModules] = useState<LessonModule[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isLoaded || !query) return;
    let cancelled = false;
    setError(false);
    setModules(null);
    query.all('learning_modules')
      .then(rows => { if (!cancelled) setModules(toModules(rows)); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isLoaded, query, reloadKey]);

  const loading = enabled && !error && (!isLoaded || modules === null);

  return (
    <Screen animated>
      <BrandHeader variant="screen" title="Lessons" subtitle="Study modules" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StateView
          loading={loading}
          error={error}
          isEmpty={!enabled || !modules || modules.length === 0}
          empty={<EmptyState ionicon="book-outline" title="No lessons yet" subtitle="Lessons arrive with the next content update." />}
          onRetry={() => setReloadKey(k => k + 1)}
        >
          {(modules ?? []).map(m => (
            <ListRow
              key={m.moduleId}
              icon="book-outline"
              title={m.moduleName || m.moduleId}
              titleLines={2}
              onPress={() => navigation.navigate('LessonReader', { moduleId: m.moduleId, moduleName: m.moduleName })}
              accessibilityLabel={`Open lesson module ${m.moduleName || m.moduleId}`}
            />
          ))}
        </StateView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 120, gap: spacing.sm },
});
