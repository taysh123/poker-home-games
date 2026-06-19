/**
 * Re-engagement reminder content gating (V2.1 STEP 3.6) — PURE + testable. Decides which local
 * reminders to schedule given the user's prefs + current signals. The native scheduling layer
 * (utils/reminders.ts) maps these to expo-notifications triggers.
 */
export type ReminderKind = 'daily_study' | 'streak_risk' | 'free_ai';

export interface ReminderPrefs {
  dailyStudy: { enabled: boolean; hour: number }; // hour 0–23
  streakRisk: boolean;
  freeAi: boolean;
}

export interface ReminderSignals {
  goalMetToday: boolean;
  streakAlive: boolean;
  isFreeUser: boolean;
  hasUnusedFreeCredit: boolean;
}

export interface ReminderSpec {
  kind: ReminderKind;
  title: string;
  body: string;
  hour: number;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  dailyStudy: { enabled: false, hour: 19 },
  streakRisk: true,
  freeAi: true,
};

/** Which reminders are eligible to schedule right now. Pure — no native calls. */
export function eligibleReminders(prefs: ReminderPrefs, signals: ReminderSignals): ReminderSpec[] {
  const out: ReminderSpec[] = [];

  if (prefs.dailyStudy.enabled) {
    out.push({
      kind: 'daily_study',
      title: 'Daily drill',
      body: 'Keep your edge — train a spot today.',
      hour: clampHour(prefs.dailyStudy.hour),
    });
  }

  // Only nudge about a streak if it's actually alive AND today's goal isn't met yet.
  if (prefs.streakRisk && signals.streakAlive && !signals.goalMetToday) {
    out.push({
      kind: 'streak_risk',
      title: '🔥 Your streak is at risk',
      body: 'Drill one spot before midnight to keep your streak alive.',
      hour: 20,
    });
  }

  // Only remind free users who still have their free analysis unused.
  if (prefs.freeAi && signals.isFreeUser && signals.hasUnusedFreeCredit) {
    out.push({
      kind: 'free_ai',
      title: 'Your free analysis is waiting',
      body: 'Get an AI read on a tough hand — on us.',
      hour: 18,
    });
  }

  return out;
}

function clampHour(h: number): number {
  if (!Number.isFinite(h)) return 19;
  return Math.max(0, Math.min(23, Math.round(h)));
}
