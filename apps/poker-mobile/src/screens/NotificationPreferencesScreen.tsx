import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import BrandHeader from '../components/BrandHeader';
import Card from '../components/Card';
import PressableScale from '../components/motion/PressableScale';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { useStudy } from '../features/study/state/StudyContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useCoach } from '../features/coach/state/CoachContext';
import { studyStats } from '../features/study/logic/progress';
import { loadReminderPrefs, saveReminderPrefs } from '../utils/reminderPrefs';
import { ensureReminderPermission, rescheduleReminders } from '../utils/reminders';
import { DEFAULT_REMINDER_PREFS, type ReminderPrefs } from '../utils/reminderLogic';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const todayKey = () => new Date().toISOString().slice(0, 10);
const fmtHour = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;

/**
 * Reminder preferences (V2.1 STEP 3.6) — local scheduled notifications, native-only. Toggling on
 * requests OS permission then reschedules; changes persist + reschedule immediately. Behind `reminders`.
 */
export default function NotificationPreferencesScreen() {
  const navigation = useNavigation<Nav>();
  const { progress } = useStudy();
  const { isPremium } = useEntitlements();
  const { creditsRemaining, policyKind } = useCoach();
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_REMINDER_PREFS);

  useEffect(() => { loadReminderPrefs().then(setPrefs); }, []);

  async function apply(next: ReminderPrefs, turnedOn: boolean) {
    setPrefs(next);
    await saveReminderPrefs(next);
    if (turnedOn) await ensureReminderPermission();
    const stats = studyStats(progress, todayKey());
    await rescheduleReminders(next, {
      goalMetToday: stats.goalMetToday,
      streakAlive: progress.currentStreak > 0,
      isFreeUser: !isPremium,
      hasUnusedFreeCredit: policyKind === 'lifetime' && creditsRemaining > 0,
    });
  }

  return (
    <Screen>
      <BrandHeader variant="screen" title="Reminders" subtitle="On-device only · never spammy" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ToggleRow
          icon="school-outline"
          title="Daily study reminder"
          sub={prefs.dailyStudy.enabled ? `Every day at ${fmtHour(prefs.dailyStudy.hour)}` : 'A gentle nudge to drill a spot'}
          value={prefs.dailyStudy.enabled}
          onChange={v => apply({ ...prefs, dailyStudy: { ...prefs.dailyStudy, enabled: v } }, v)}
        />
        {prefs.dailyStudy.enabled && (
          <View style={styles.hourRow}>
            <Text style={styles.hourLabel}>Reminder time</Text>
            <View style={styles.stepper}>
              <PressableScale style={styles.stepBtn} onPress={() => apply({ ...prefs, dailyStudy: { ...prefs.dailyStudy, hour: (prefs.dailyStudy.hour + 23) % 24 } }, false)} accessibilityRole="button" accessibilityLabel="Earlier reminder time">
                <Ionicons name="remove" size={16} color={colors.gold} />
              </PressableScale>
              <Text style={styles.hourVal}>{fmtHour(prefs.dailyStudy.hour)}</Text>
              <PressableScale style={styles.stepBtn} onPress={() => apply({ ...prefs, dailyStudy: { ...prefs.dailyStudy, hour: (prefs.dailyStudy.hour + 1) % 24 } }, false)} accessibilityRole="button" accessibilityLabel="Later reminder time">
                <Ionicons name="add" size={16} color={colors.gold} />
              </PressableScale>
            </View>
          </View>
        )}
        <ToggleRow
          icon="flame-outline"
          title="Streak at risk"
          sub="Evening nudge if your streak is alive but today's goal isn't met"
          value={prefs.streakRisk}
          onChange={v => apply({ ...prefs, streakRisk: v }, v)}
        />
        <ToggleRow
          icon="sparkles-outline"
          title="Unused free analysis"
          sub="Remind me to use my free AI Coach analysis"
          value={prefs.freeAi}
          onChange={v => apply({ ...prefs, freeAi: v }, v)}
        />
        <Text style={styles.note}>Reminders are scheduled on your device. No data leaves the app.</Text>
      </ScrollView>
    </Screen>
  );
}

function ToggleRow({ icon, title, sub, value, onChange }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <Card style={styles.row}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={20} color={colors.gold} /></View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceHigh, true: colors.goldMuted }}
        thumbColor={value ? colors.gold : colors.textDim}
        accessibilityLabel={title}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 60, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.label, color: colors.text },
  rowSub: { ...typography.bodySmall, color: colors.textMuted },
  hourRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  hourLabel: { ...typography.bodySmall, color: colors.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { width: 34, height: 34, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldFaint, borderWidth: 1, borderColor: colors.goldMuted },
  hourVal: { ...typography.label, color: colors.text, minWidth: 76, textAlign: 'center' },
  note: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
