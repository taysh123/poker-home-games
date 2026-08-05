/**
 * Provider-level WIRING pins for the monotonic-XP invariant (Q0, critic find C0).
 *
 * The pure functions (computeXp / xpAchievementCount / isEarned) were already pinned, but a
 * verifier proved by mutation that reverting EngagementContext to eligibility-based counting
 * passed the entire suite. These tests use DISCRIMINATING fixtures (seen-count ≠ eligible-count)
 * so the exact pre-Q0 bug — `eligibleKeys(signals).length` feeding computeXp — fails here.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { EngagementProvider, useEngagement } from '../EngagementContext';
import { computeXp } from '../../logic/xp';

// Mounting the real provider is heavy, and on a COLD jest transform cache it exceeds jest's 5s
// default and fails as a TIMEOUT rather than an assertion. CI is always cold — the workflow caches
// node_modules, never jest's transform cache — so this failed intermittently there while passing
// on any warm local run, and the red landed on whatever slice happened to be in flight. Same
// treatment, and same reasoning, as isCelebrating.test.tsx. Scoped to this file; the repo-wide
// default is deliberately left alone.
jest.setTimeout(20_000);
import type { EngagementSignals } from '../../types';
import type { BankrollSession } from '../../../bankroll/types';

let mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((k: string) => Promise.resolve(mockStorage[k] ?? null)),
    setItem: jest.fn((k: string, v: string) => { mockStorage[k] = v; return Promise.resolve(); }),
    removeItem: jest.fn((k: string) => { delete mockStorage[k]; return Promise.resolve(); }),
  },
}));

const mockTrack = jest.fn();
jest.mock('../../../../utils/analytics', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));
// Presentation-only — irrelevant to the wiring under test, and their icon-font imports don't
// resolve in this jest context.
jest.mock('../../../../components/AchievementUnlock', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../../components/motion/Celebration', () => ({ __esModule: true, default: () => null }));

// Pillar fixtures — studyStreak 0 with study_streak_7 SEEN is the discriminating shape:
// eligible = {study_first} (1) but seen = {study_first, study_streak_7} (2).
const mockProgress = {
  totalAnswered: 10,
  totalCorrect: 8,
  currentStreak: 0,
  dailyCounts: { '2026-07-01': 5, '2026-07-02': 5 },
  quizzesCompleted: 0,
  lessonsCompleted: 0,
  dailyGoal: 10,
};
jest.mock('../../../study/state/StudyContext', () => ({ useStudy: () => ({ progress: mockProgress, isLoaded: true }) }));
// Mutable so the bankrollPositiveMonth-wiring tests below can override it per-test (mirrors the
// mockStorage pattern above) — every OTHER test in this file relies on it defaulting to [].
let mockBankrollSessions: BankrollSession[] = [];
jest.mock('../../../bankroll/state/BankrollContext', () => ({ useBankroll: () => ({ sessions: mockBankrollSessions, isLoaded: true }) }));
jest.mock('../../../coach/state/CoachContext', () => ({ useCoach: () => ({ history: [], isLoaded: true }) }));
jest.mock('../../../../context/LocalGamesContext', () => ({ useLocalGames: () => ({ games: [], isLoaded: true }) }));

const STORE_KEY = 'tpoker.engagement.v1';
const SIGNALS: EngagementSignals = {
  spotsAnswered: 10, studyStreak: 0, studyDays: 2, bankrollSessions: 0,
  bankrollPositiveMonth: false, coachAnalyses: 0, localGamesFinished: 0,
  quizzesCompleted: 0, lessonsCompleted: 0,
};

function Probe() {
  const { xpTotal, isLoaded } = useEngagement();
  return <Text testID="probe">{isLoaded ? `xp:${xpTotal}` : 'loading'}</Text>;
}

const mount = () => render(<EngagementProvider><Probe /></EngagementProvider>);

beforeEach(() => { mockStorage = {}; mockTrack.mockClear(); mockBankrollSessions = []; });

describe('EngagementContext — monotonic-XP wiring (Q0 pin)', () => {
  it('XP counts SEEN achievements even when their predicates have lapsed (never live eligibility)', async () => {
    // 2 seen badges, only 1 still eligible (streak broken). Seen-based XP = signals + 2×25;
    // the pre-Q0 eligibility bug would compute signals + 1×25.
    mockStorage[STORE_KEY] = JSON.stringify({
      schemaVersion: 1, seeded: true,
      seenAchievements: { study_first: '2026-07-01T00:00:00.000Z', study_streak_7: '2026-07-01T00:00:00.000Z' },
      lastXp: computeXp(SIGNALS, 2),
    });
    const { getByTestId } = mount();
    await waitFor(() => expect(getByTestId('probe').props.children).toBe(`xp:${computeXp(SIGNALS, 2)}`));
    expect(mockTrack).not.toHaveBeenCalledWith('rank_up', expect.anything());
  });

  it('first-run seeding stores a lastXp consistent with the rendered total — no phantom rank-up', async () => {
    const { getByTestId } = mount(); // empty storage → seed path
    // eligible = {study_first} only (streak 0) → seeded seen has 1 key.
    await waitFor(() => expect(getByTestId('probe').props.children).toBe(`xp:${computeXp(SIGNALS, 1)}`));
    const saved = JSON.parse(mockStorage[STORE_KEY]);
    expect(saved.seeded).toBe(true);
    expect(saved.lastXp).toBe(computeXp(SIGNALS, 1));
    expect(mockTrack).not.toHaveBeenCalledWith('rank_up', expect.anything());
  });

  it('a restorative XP catch-up at cold open syncs lastXp upward SILENTLY (Q0 finds m0/m7)', async () => {
    // Existing user whose stored lastXp was docked by the old eligibility formula, low enough
    // that the corrected total crosses a rank boundary — must NOT celebrate at an idle open.
    const dockedLastXp = 0;
    mockStorage[STORE_KEY] = JSON.stringify({
      schemaVersion: 1, seeded: true,
      seenAchievements: {
        study_first: 'iso', study_streak_7: 'iso', study_streak_30: 'iso',
        study_century: 'iso', play_first: 'iso', bankroll_first: 'iso',
        bankroll_ten: 'iso', bankroll_green_month: 'iso', coach_first: 'iso', coach_ten: 'iso',
      },
      lastXp: dockedLastXp,
    });
    const expected = computeXp(SIGNALS, 10); // 10×25 = 250+ → crosses at least Reg (250)
    const { getByTestId } = mount();
    await waitFor(() => expect(getByTestId('probe').props.children).toBe(`xp:${expected}`));
    expect(mockTrack).not.toHaveBeenCalledWith('rank_up', expect.anything());
    await waitFor(() => expect(JSON.parse(mockStorage[STORE_KEY]).lastXp).toBe(expected));
  });
});

describe('EngagementContext — bankrollPositiveMonth wiring (B3 fleet-found gap, 2026-08-05)', () => {
  // Every test above mocks useBankroll with sessions: [] and never observes this signal, so none
  // of them exercise netCentsForMonth's real summation path (B3) through EngagementContext — only
  // its empty-array fallback. This probe exposes signals directly rather than going through
  // xpTotal/achievements, so it stays isolated from the unrelated XP-formula/achievement-catalog
  // details the tests above are pinning.
  function SignalProbe() {
    const { signals, isLoaded } = useEngagement();
    return <Text testID="signalProbe">{isLoaded ? String(signals.bankrollPositiveMonth) : 'loading'}</Text>;
  }
  const mountSignalProbe = () => render(<EngagementProvider><SignalProbe /></EngagementProvider>);

  const session = (over: Partial<BankrollSession> & { cash: NonNullable<BankrollSession['cash']> }): BankrollSession => ({
    id: 's1', gameType: 'cash', source: 'external', currency: 'ILS',
    startedAt: new Date().toISOString(), // "now" is trivially within the current local month
    feesCents: 0, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...over,
  });

  it('is true when this local month\'s real bankroll sessions net positive', async () => {
    mockBankrollSessions = [session({ cash: { buyInCents: 5000, cashOutCents: 9000 } })]; // +4000
    const { getByTestId } = mountSignalProbe();
    await waitFor(() => expect(getByTestId('signalProbe').props.children).toBe('true'));
  });

  it('is false when this local month\'s real bankroll sessions net negative', async () => {
    mockBankrollSessions = [session({ cash: { buyInCents: 9000, cashOutCents: 5000 } })]; // -4000
    const { getByTestId } = mountSignalProbe();
    await waitFor(() => expect(getByTestId('signalProbe').props.children).toBe('false'));
  });
});
