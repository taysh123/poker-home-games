import { eligibleReminders, DEFAULT_REMINDER_PREFS, type ReminderPrefs, type ReminderSignals } from '../reminderLogic';

const prefs = (over: Partial<ReminderPrefs> = {}): ReminderPrefs => ({
  ...DEFAULT_REMINDER_PREFS, dailyStudy: { ...DEFAULT_REMINDER_PREFS.dailyStudy }, ...over,
});
const signals = (over: Partial<ReminderSignals> = {}): ReminderSignals => ({
  goalMetToday: false, streakAlive: false, isFreeUser: true, hasUnusedFreeCredit: false, ...over,
});

describe('eligibleReminders', () => {
  it('schedules the daily study reminder only when enabled, at the configured hour', () => {
    expect(eligibleReminders(prefs(), signals()).some(r => r.kind === 'daily_study')).toBe(false);
    const r = eligibleReminders(prefs({ dailyStudy: { enabled: true, hour: 8 } }), signals());
    const ds = r.find(x => x.kind === 'daily_study');
    expect(ds?.hour).toBe(8);
  });

  it('fires streak_risk only when a streak is alive and the goal is unmet', () => {
    expect(eligibleReminders(prefs(), signals({ streakAlive: true, goalMetToday: false })).some(r => r.kind === 'streak_risk')).toBe(true);
    expect(eligibleReminders(prefs(), signals({ streakAlive: true, goalMetToday: true })).some(r => r.kind === 'streak_risk')).toBe(false);
    expect(eligibleReminders(prefs(), signals({ streakAlive: false })).some(r => r.kind === 'streak_risk')).toBe(false);
    expect(eligibleReminders(prefs({ streakRisk: false }), signals({ streakAlive: true })).some(r => r.kind === 'streak_risk')).toBe(false);
  });

  it('fires free_ai only for free users with an unused credit', () => {
    expect(eligibleReminders(prefs(), signals({ isFreeUser: true, hasUnusedFreeCredit: true })).some(r => r.kind === 'free_ai')).toBe(true);
    expect(eligibleReminders(prefs(), signals({ isFreeUser: false, hasUnusedFreeCredit: true })).some(r => r.kind === 'free_ai')).toBe(false);
    expect(eligibleReminders(prefs(), signals({ isFreeUser: true, hasUnusedFreeCredit: false })).some(r => r.kind === 'free_ai')).toBe(false);
  });

  it('clamps an out-of-range daily hour', () => {
    const r = eligibleReminders(prefs({ dailyStudy: { enabled: true, hour: 99 } }), signals());
    expect(r.find(x => x.kind === 'daily_study')?.hour).toBe(23);
  });

  it('all reminders off by prefs ⇒ none scheduled', () => {
    const none = eligibleReminders(prefs({ streakRisk: false, freeAi: false }), signals({ streakAlive: true, hasUnusedFreeCredit: true }));
    expect(none).toHaveLength(0);
  });
});
