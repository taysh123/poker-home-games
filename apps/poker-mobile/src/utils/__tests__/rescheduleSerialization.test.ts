/**
 * Critic find C0 (2.4): rescheduleReminders is cancelAll-then-schedule against the OS — two
 * overlapping runs used to interleave (one run's cancelAll landing between another's schedule
 * calls), duplicating or stranding reminders. The funnel must SERIALIZE concurrent calls and
 * let the latest call win. Run identity is detected via the mockScheduled CONTENT (each run's
 * game_day body carries its own crew line).
 */
let mockScheduled: { title: string; body: string }[] = [];
let mockCancelAllCalls = 0;

// No react-native mock needed — the jest-expo preset already provides Platform.OS 'ios',
// and whole-module replacements are a cross-file leak hazard (see jestMockHygieneBan.test.ts).
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) },
}));
jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    mockCancelAllCalls++;
    mockScheduled = [];
    await new Promise(r => setTimeout(r, 5)); // widen the interleave window
  }),
  scheduleNotificationAsync: jest.fn(async (req: { content: { title: string; body: string } }) => {
    mockScheduled.push({ title: req.content.title, body: req.content.body });
    await new Promise(r => setTimeout(r, 5));
  }),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

import { rescheduleReminders } from '../reminders';
import { DEFAULT_REMINDER_PREFS, type ReminderSignals } from '../reminderLogic';

const NOW = new Date(2026, 6, 27, 12, 0, 0, 0).getTime();
const signals = (crewLine: string): ReminderSignals => ({
  goalMetToday: false,
  streakAlive: true, // streak_risk eligible → three specs per run
  nextGame: { gameDay: '2026-08-01', crewLine },
  nowMs: NOW,
});
const prefs = { ...DEFAULT_REMINDER_PREFS, dailyStudy: { enabled: true, hour: 9 } };

beforeEach(() => { mockScheduled = []; mockCancelAllCalls = 0; });

describe('rescheduleReminders serialization', () => {
  it('two concurrent calls never interleave — the surviving set is ONE complete run, latest wins', async () => {
    const a = rescheduleReminders(prefs, signals('Crew A'));
    const b = rescheduleReminders(prefs, signals('Crew B'));
    await Promise.all([a, b]);

    // Unserialized, B's cancelAll lands mid-A and both sets accumulate (6 entries / torn mix).
    expect(mockScheduled.length).toBe(3);
    const gameNight = mockScheduled.find(s => s.title === 'Game night');
    expect(gameNight?.body).toContain('Crew B');
  });

  it('a queued run that is already superseded is skipped entirely (no churn)', async () => {
    const a = rescheduleReminders(prefs, signals('Crew A'));
    const b = rescheduleReminders(prefs, signals('Crew B'));
    const c = rescheduleReminders(prefs, signals('Crew C'));
    await Promise.all([a, b, c]);

    // A runs (it started first), B is superseded by C before it starts → only A and C cancelAll.
    expect(mockCancelAllCalls).toBeLessThanOrEqual(2);
    expect(mockScheduled.length).toBe(3);
    expect(mockScheduled.find(s => s.title === 'Game night')?.body).toContain('Crew C');
  });
});
