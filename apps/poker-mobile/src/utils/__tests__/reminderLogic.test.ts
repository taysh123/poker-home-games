import { eligibleReminders, DEFAULT_REMINDER_PREFS, GAME_DAY_REMINDER_HOUR, type ReminderPrefs, type ReminderSignals } from '../reminderLogic';

const prefs = (over: Partial<ReminderPrefs> = {}): ReminderPrefs => ({
  ...DEFAULT_REMINDER_PREFS, dailyStudy: { ...DEFAULT_REMINDER_PREFS.dailyStudy }, ...over,
});
// Fixed "now": 2026-07-25 12:00 local. Constructed from components so expectations hold in any TZ.
const NOW = new Date(2026, 6, 25, 12, 0, 0, 0).getTime();
const signals = (over: Partial<ReminderSignals> = {}): ReminderSignals => ({
  goalMetToday: false, streakAlive: false, nextGame: null, nowMs: NOW, ...over,
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

  it('all reminders off by prefs ⇒ none scheduled, even with a live streak and a dated plan', () => {
    const none = eligibleReminders(
      prefs({ streakRisk: false, gameDay: false }),
      signals({ streakAlive: true, nextGame: { gameDay: '2026-08-01', crewLine: 'Alex, Dana' } }),
    );
    expect(none).toHaveLength(0);
  });
});

describe('game_day one-shot (2.4 — the pre-session moment)', () => {
  const futurePlan = { gameDay: '2026-08-01', crewLine: 'Alex, Dana +2' };

  it('emits a one-shot for a future game day at the game-day hour, LOCAL time', () => {
    const specs = eligibleReminders(prefs(), signals({ nextGame: futurePlan }));
    const gd = specs.find(s => s.kind === 'game_day');
    expect(gd).toBeDefined();
    expect(gd?.hour).toBe(GAME_DAY_REMINDER_HOUR);
    // Local-component construction — new Date('2026-08-01') (UTC midnight) would shift the day
    // in negative-offset timezones; the fire time must be 17:00 LOCAL on the game day.
    expect(gd?.fireAtMs).toBe(new Date(2026, 7, 1, GAME_DAY_REMINDER_HOUR, 0, 0, 0).getTime());
    expect(gd?.body).toContain('Alex, Dana +2');
  });

  it('emits on the game day itself while the fire hour is still ahead', () => {
    const specs = eligibleReminders(prefs(), signals({ nextGame: { gameDay: '2026-07-25', crewLine: 'Alex' } }));
    expect(specs.some(s => s.kind === 'game_day')).toBe(true); // now = 12:00 < 17:00
  });

  it('skips when the fire hour has already passed on the game day (a past one-shot fires instantly)', () => {
    const evening = new Date(2026, 6, 25, 18, 30, 0, 0).getTime();
    const specs = eligibleReminders(prefs(), signals({ nextGame: { gameDay: '2026-07-25', crewLine: 'Alex' }, nowMs: evening }));
    expect(specs.some(s => s.kind === 'game_day')).toBe(false);
  });

  it('skips past game days, undated plans, and malformed day keys', () => {
    expect(eligibleReminders(prefs(), signals({ nextGame: { gameDay: '2026-07-20', crewLine: 'Alex' } })).some(s => s.kind === 'game_day')).toBe(false);
    expect(eligibleReminders(prefs(), signals({ nextGame: null })).some(s => s.kind === 'game_day')).toBe(false);
    expect(eligibleReminders(prefs(), signals({ nextGame: { gameDay: 'not-a-day', crewLine: 'Alex' } })).some(s => s.kind === 'game_day')).toBe(false);
  });

  it('is pref-gated (opt-out) and copes with an empty crew line', () => {
    expect(eligibleReminders(prefs({ gameDay: false }), signals({ nextGame: futurePlan })).some(s => s.kind === 'game_day')).toBe(false);
    const gd = eligibleReminders(prefs(), signals({ nextGame: { gameDay: '2026-08-01', crewLine: '' } })).find(s => s.kind === 'game_day');
    expect(gd?.body).toBeTruthy();
    expect(gd?.body).not.toMatch(/^\s*—/); // no dangling separator when there are no names
  });
});

describe('honesty — reminders never promise unavailable features (Wave 0.3 pin)', () => {
  // The dormant free_ai reminder push-advertised "Your free analysis is waiting" while the AI
  // Coach is "Coming soon" with zero API calls (critique blocker). With the `reminders` flag now
  // ON in prod, this pin guarantees no producible reminder ever references AI/analysis until the
  // coach actually ships — and that the kind vocabulary stays exactly the honest set.
  // 2.4 DELIBERATE EXTENSION: 'game_day' joined the vocabulary — a heads-up about the user's own
  // planned home game plus an invite to the (live, free) practice pool. Nothing promised beyond
  // what ships today.
  it('with every pref on and every signal true, only daily_study, streak_risk and game_day are producible', () => {
    const everythingOn = prefs({ dailyStudy: { enabled: true, hour: 19 }, streakRisk: true, gameDay: true });
    // Every signal at its most permissive — including a dated future plan so game_day is exercised.
    // (When the coach ships and a reminder kind returns for it, this pin forces the addition to be
    // a DELIBERATE, reviewed change.)
    const allSignals = signals({ goalMetToday: false, streakAlive: true, nextGame: { gameDay: '2026-08-01', crewLine: 'Alex, Dana' } });
    const specs = eligibleReminders(everythingOn, allSignals);
    expect(specs.map(s => s.kind).sort()).toEqual(['daily_study', 'game_day', 'streak_risk']);
    for (const spec of specs) {
      expect(`${spec.title} ${spec.body}`).not.toMatch(/\bAI\b|analysis|coach/i);
    }
  });
});
