/**
 * Lesson Modules (PR #3) — lists learning modules from the ContentStore (read-only, via useContent().query;
 * never touches the workbook). Flag-gated (`content`); shows honest empty state until real content (D2) lands.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import SkeletonRow from '../../../components/SkeletonRow';
import PressableScale from '../../../components/motion/PressableScale';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
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

  useEffect(() => {
    if (!isLoaded || !query) return;
    let cancelled = false;
    query.all('learning_modules')
      .then(rows => { if (!cancelled) setModules(toModules(rows)); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isLoaded, query]);

  const loading = enabled && !error && (!isLoaded || modules === null);

  return (
    <Screen>
      <BrandHeader variant="screen" title="Lessons" subtitle="Study modules" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <EmptyState ionicon="alert-circle-outline" title="Couldn't load lessons" subtitle="Please try again in a moment." />
        ) : loading ? (
          <>{[0, 1, 2, 3].map(i => <SkeletonRow key={i} isFirst={i === 0} />)}</>
        ) : !enabled || !modules || modules.length === 0 ? (
          <EmptyState ionicon="book-outline" title="No lessons yet" subtitle="Lessons arrive with the next content update." />
        ) : (
          modules.map(m => (
            <PressableScale key={m.moduleId} haptic="light" accessibilityRole="button" accessibilityLabel={`Open lesson module ${m.moduleName || m.moduleId}`} onPress={() => navigation.navigate('LessonReader', { moduleId: m.moduleId, moduleName: m.moduleName })}>
              <Card style={styles.row}>
                <View style={styles.icon}><Ionicons name="book-outline" size={20} color={colors.gold} /></View>
                <Text style={styles.name} numberOfLines={2}>{m.moduleName || m.moduleId}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Card>
            </PressableScale>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 120, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.h4, color: colors.text, flex: 1 },
});
