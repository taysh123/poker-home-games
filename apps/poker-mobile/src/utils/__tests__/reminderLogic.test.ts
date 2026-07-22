import { eligibleReminders, DEFAULT_REMINDER_PREFS, type ReminderPrefs, type ReminderSignals } from '../reminderLogic';

const prefs = (over: Partial<ReminderPrefs> = {}): ReminderPrefs => ({
  ...DEFAULT_REMINDER_PREFS, dailyStudy: { ...DEFAULT_REMINDER_PREFS.dailyStudy }, ...over,
});
const signals = (over: Partial<ReminderSignals> = {}): ReminderSignals => ({
  goalMetToday: false, streakAlive: false, ...over,
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

  it('clamps an out-of-range daily hour', () => {
    const r = eligibleReminders(prefs({ dailyStudy: { enabled: true, hour: 99 } }), signals());
    expect(r.find(x => x.kind === 'daily_study')?.hour).toBe(23);
  });

  it('all reminders off by prefs ⇒ none scheduled', () => {
    const none = eligibleReminders(prefs({ streakRisk: false }), signals({ streakAlive: true }));
    expect(none).toHaveLength(0);
  });
});

describe('honesty — reminders never promise unavailable features (Wave 0.3 pin)', () => {
  // The dormant free_ai reminder push-advertised "Your free analysis is waiting" while the AI
  // Coach is "Coming soon" with zero API calls (critique blocker). With the `reminders` flag now
  // ON in prod, this pin guarantees no producible reminder ever references AI/analysis until the
  // coach actually ships — and that the kind vocabulary stays exactly the honest set.
  it('with every pref on and every signal true, only daily_study and streak_risk are producible', () => {
    const everythingOn = prefs({ dailyStudy: { enabled: true, hour: 19 }, streakRisk: true });
    // Every signal at its most permissive. (When the coach ships and a reminder kind returns for
    // it, this pin forces the addition to be a DELIBERATE, reviewed change.)
    const allSignals = signals({ goalMetToday: false, streakAlive: true });
    const specs = eligibleReminders(everythingOn, allSignals);
    expect(specs.length).toBeGreaterThan(0);
    for (const spec of specs) {
      expect(['daily_study', 'streak_risk']).toContain(spec.kind);
      expect(`${spec.title} ${spec.body}`).not.toMatch(/\bAI\b|analysis|coach/i);
    }
  });
});
