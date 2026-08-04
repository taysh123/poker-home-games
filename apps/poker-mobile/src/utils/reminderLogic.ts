/**
 * Re-engagement reminder content gating (V2.1 STEP 3.6) — PURE + testable. Decides which local
 * reminders to schedule given the user's prefs + current signals. The native scheduling layer
 * (utils/reminders.ts) maps these to expo-notifications triggers.
 *
 * HONESTY (Wave 0.3): the reminder vocabulary is exactly the features that are LIVE. The old
 * 'free_ai' kind push-advertised an AI analysis while the coach is "Coming soon" (zero API
 * calls) — it was removed before the `reminders` flag flipped ON, and the honesty pin in
 * reminderLogic.test.ts keeps any AI/coach promise out until the coach actually ships.
 *
 * 2.4 added 'game_day' (deliberate, reviewed vocabulary extension): a ONE-SHOT heads-up on the
 * day the user's own next-game plan lands, inviting a warm-up in the live free practice pool.
 * It is the only spec carrying `fireAtMs` (DATE trigger); the other two stay repeating-daily.
 */
export type ReminderKind = 'daily_study' | 'streak_risk' | 'game_day';

export interface ReminderPrefs {
  dailyStudy: { enabled: boolean; hour: number }; // hour 0–23
  streakRisk: boolean;
  /** Heads-up on the planned game day (2.4). Opt-out — planning a game is the opt-in gesture. */
  gameDay: boolean;
}

export interface ReminderSignals {
  goalMetToday: boolean;
  streakAlive: boolean;
  /** The single on-device next-game plan (2.4): dated plans only. crewLine is display-ready. */
  nextGame: { gameDay: string; crewLine: string } | null;
  /** Epoch ms "now", injected so the one-shot computation stays pure/testable. */
  nowMs: number;
}

export interface ReminderSpec {
  kind: ReminderKind;
  title: string;
  body: string;
  hour: number;
  /** One-shot fire time (epoch ms). Present ⇒ the scheduler uses a DATE trigger, not a repeating hour. */
  fireAtMs?: number;
}

/** Late-afternoon heads-up — early enough to warm up, late enough to be "tonight". */
export const GAME_DAY_REMINDER_HOUR = 17;

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  dailyStudy: { enabled: false, hour: 19 },
  streakRisk: true,
  gameDay: true,
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
  //
  // ONE-SHOT for TODAY only — never a repeating trigger (pre-Q2 audit fix). Both goalMetToday
  // and streakAlive are DAILY-VARYING signals, but eligibility is only ever re-evaluated on app
  // mount/foreground; a {hour: 20, repeats: true} trigger, once scheduled, kept firing every
  // night forever regardless of whether the streak later died or the goal was later met by other
  // means — for any user who went dark after the reminder was scheduled, false from ~day 2.
  // Mirrors game_day's fireAtMs pattern: skipped once today's fire hour has passed (a past DATE
  // trigger fires instantly on both platforms), so a stale eligibility check produces silence,
  // never a lie. If still eligible next time the app foregrounds, THAT day computes its own
  // fireAtMs — one scheduling call can never describe more than one night.
  if (prefs.streakRisk && signals.streakAlive && !signals.goalMetToday) {
    const fireAtMs = localDayHourMs(localDayKeyFor(signals.nowMs), 20);
    if (fireAtMs != null && fireAtMs > signals.nowMs) {
      out.push({
        kind: 'streak_risk',
        title: '🔥 Your streak is at risk',
        body: 'Drill one spot before midnight to keep your streak alive.',
        hour: 20,
        fireAtMs,
      });
    }
  }

  // Game-day one-shot: only while the fire moment is still ahead — a past DATE trigger fires
  // instantly on both platforms, so late-day scheduling is skipped rather than spammed.
  if (prefs.gameDay && signals.nextGame) {
    const fireAtMs = localDayHourMs(signals.nextGame.gameDay, GAME_DAY_REMINDER_HOUR);
    if (fireAtMs != null && fireAtMs > signals.nowMs) {
      const crew = signals.nextGame.crewLine;
      out.push({
        kind: 'game_day',
        title: 'Game night',
        body: crew
          ? `${crew} — tonight's the game. Warm up with a few practice hands?`
          : "Tonight's the game. Warm up with a few practice hands?",
        hour: GAME_DAY_REMINDER_HOUR,
        fireAtMs,
      });
    }
  }

  return out;
}

/** Today's 'YYYY-MM-DD' from LOCAL components of the given epoch ms — mirrors
 * features/study/logic/localDay.ts#localDayKey without importing it, keeping this module
 * dependency-free (it stays zero-import, pure, nowMs-injected throughout). Deliberately NOT the
 * UTC-based ISO-string slice this repo bans repo-wide (dayKeyBan.test.ts) — that shortcut flips
 * the day at 02:00–03:00 Israel time, not local midnight. */
function localDayKeyFor(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 'YYYY-MM-DD' + hour → epoch ms via LOCAL components. `new Date('YYYY-MM-DD')` is UTC midnight
 * and lands the previous evening in positive-offset timezones — never use it for day keys. */
function localDayHourMs(dayKey: string, hour: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, 0, 0, 0).getTime();
}

function clampHour(h: number): number {
  if (!Number.isFinite(h)) return 19;
  return Math.max(0, Math.min(23, Math.round(h)));
}
