/**
 * Reschedules local reminders on mount + whenever the app returns to the foreground or the relevant
 * signals change (V2.1 STEP 3.6). No-op unless the `reminders` flag is on (and native). Reads study
 * progress + entitlement + coach credits to gate streak/free-AI nudges.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { isFeatureEnabled } from '../config/features';
import { useStudy } from '../features/study/state/StudyContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useCoach } from '../features/coach/state/CoachContext';
import { studyStats } from '../features/study/logic/progress';
import { loadReminderPrefs } from '../utils/reminderPrefs';
import { rescheduleReminders } from '../utils/reminders';

const todayKey = () => new Date().toISOString().slice(0, 10);

export function useReminderScheduler(): void {
  const enabled = isFeatureEnabled('reminders');
  const { progress } = useStudy();
  const { isPremium } = useEntitlements();
  const { creditsRemaining, policyKind } = useCoach();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      const prefs = await loadReminderPrefs();
      const stats = studyStats(progress, todayKey());
      const signals = {
        goalMetToday: stats.goalMetToday,
        streakAlive: progress.currentStreak > 0,
        isFreeUser: !isPremium,
        hasUnusedFreeCredit: policyKind === 'lifetime' && creditsRemaining > 0,
      };
      if (!cancelled) await rescheduleReminders(prefs, signals);
    };

    run();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') run(); });
    return () => { cancelled = true; sub.remove(); };
  }, [enabled, progress.currentStreak, progress.totalAnswered, progress.dailyGoal, isPremium, creditsRemaining, policyKind]);
}

/** Mountable wrapper (renders nothing) so the hook can live inside the provider tree. */
export function ReminderScheduler(): null {
  useReminderScheduler();
  return null;
}
