/**
 * Reschedules local reminders on mount + whenever the app returns to the foreground or the relevant
 * signals change (V2.1 STEP 3.6). No-op unless the `reminders` flag is on (and native). Reads study
 * progress to gate the streak nudge. Day keys are LOCAL midnight (localDayKey) — the UTC shortcut
 * reset at 02:00–03:00 Israel time (banned by dayKeyBan.test.ts).
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { isFeatureEnabled } from '../config/features';
import { useStudy } from '../features/study/state/StudyContext';
import { studyStats } from '../features/study/logic/progress';
import { localDayKey } from '../features/study/logic/localDay';
import { useNextGamePlan } from '../context/NextGamePlanContext';
import { crewSummary } from '../features/engagement/logic/nextGamePlan';
import { loadReminderPrefs } from '../utils/reminderPrefs';
import { rescheduleReminders } from '../utils/reminders';

export function useReminderScheduler(): void {
  const enabled = isFeatureEnabled('reminders');
  const { progress } = useStudy();
  const { plan } = useNextGamePlan();
  // Scalar deps, not the plan object (critic find C1): the effect re-runs only when the values
  // the schedule actually consumes change. Set/clear/stale-auto-clear all change these scalars —
  // that re-run IS the "schedule on create, cancel on clear" mechanism.
  const planGameDay = plan?.gameDay ?? null;
  const planCrewLine = plan ? crewSummary(plan.crew) : '';

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      const prefs = await loadReminderPrefs();
      const stats = studyStats(progress, localDayKey());
      const signals = {
        goalMetToday: stats.goalMetToday,
        streakAlive: progress.currentStreak > 0,
        nextGame: planGameDay ? { gameDay: planGameDay, crewLine: planCrewLine } : null,
        nowMs: Date.now(),
      };
      if (!cancelled) await rescheduleReminders(prefs, signals);
    };

    run();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') run(); });
    return () => { cancelled = true; sub.remove(); };
  }, [enabled, progress.currentStreak, progress.totalAnswered, progress.dailyGoal, planGameDay, planCrewLine]);
}

/** Mountable wrapper (renders nothing) so the hook can live inside the provider tree. */
export function ReminderScheduler(): null {
  useReminderScheduler();
  return null;
}
