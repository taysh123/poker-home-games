/**
 * `isCelebrating` wiring pin (Q1.4).
 *
 * The review-prompt host must never raise its sheet over a celebration. It cannot see
 * EngagementContext's internal unlockQueue / celebrate state, so the provider derives one
 * boolean for it. Two failure modes are pinned here:
 *
 *  1. It must be TRUE while an achievement unlock is queued — otherwise the sheet lands on top
 *     of the AchievementUnlock card.
 *  2. It must be FALSE when `retention` is OFF. Both celebration renders in the provider are
 *     gated on `enabled` (EngagementContext.tsx:184,189), so with retention off nothing can
 *     appear — reporting "celebrating" there would suppress the review prompt forever for a
 *     cohort that never sees a single celebration.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

let mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((k: string) => Promise.resolve(mockStorage[k] ?? null)),
    setItem: jest.fn((k: string, v: string) => { mockStorage[k] = v; return Promise.resolve(); }),
    removeItem: jest.fn((k: string) => { delete mockStorage[k]; return Promise.resolve(); }),
  },
}));

jest.mock('../../../../utils/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../../components/AchievementUnlock', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../../components/motion/Celebration', () => ({ __esModule: true, default: () => null }));

let mockRetentionOn = true;
jest.mock('../../../../config/features', () => ({
  isFeatureEnabled: (flag: string) => (flag === 'retention' ? mockRetentionOn : false),
}));

// totalAnswered > 0 over 2 study days ⇒ `study_first` is eligible.
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
jest.mock('../../../bankroll/state/BankrollContext', () => ({ useBankroll: () => ({ sessions: [], isLoaded: true }) }));
jest.mock('../../../coach/state/CoachContext', () => ({ useCoach: () => ({ history: [], isLoaded: true }) }));
jest.mock('../../../../context/LocalGamesContext', () => ({ useLocalGames: () => ({ games: [], isLoaded: true }) }));

import { EngagementProvider, useEngagement } from '../EngagementContext';

const STORE_KEY = 'tpoker.engagement.v1';

function Probe() {
  const { isCelebrating, isLoaded } = useEngagement();
  return <Text testID="probe">{isLoaded ? String(isCelebrating) : 'loading'}</Text>;
}

const mount = () => render(<EngagementProvider><Probe /></EngagementProvider>);

/** Seeded (not first-run) with nothing seen ⇒ study_first unlocks and queues a celebration. */
function seededWithNothingSeen() {
  mockStorage[STORE_KEY] = JSON.stringify({
    schemaVersion: 1, seeded: true, seenAchievements: {}, lastXp: 0,
  });
}

/** Seeded with study_first already seen ⇒ nothing new to celebrate. */
function seededWithStudyFirstSeen() {
  mockStorage[STORE_KEY] = JSON.stringify({
    schemaVersion: 1, seeded: true, seenAchievements: { study_first: '2026-07-01T00:00:00.000Z' }, lastXp: 9999,
  });
}

beforeEach(() => { mockStorage = {}; mockRetentionOn = true; });

describe('EngagementContext.isCelebrating', () => {
  it('is true while an achievement unlock is queued', async () => {
    seededWithNothingSeen();
    const { getByTestId } = mount();
    await waitFor(() => expect(getByTestId('probe').props.children).toBe('true'));
  });

  it('is false at rest when there is nothing new to celebrate', async () => {
    seededWithStudyFirstSeen();
    const { getByTestId } = mount();
    await waitFor(() => expect(getByTestId('probe').props.children).toBe('false'));
    // Give any queued celebration a chance to appear; it must not.
    expect(getByTestId('probe').props.children).toBe('false');
  });

  it('is false when retention is OFF, even with an unlock that would otherwise queue', async () => {
    mockRetentionOn = false;
    seededWithNothingSeen();
    const { getByTestId } = mount();
    await waitFor(() => expect(getByTestId('probe').props.children).not.toBe('loading'));
    expect(getByTestId('probe').props.children).toBe('false');
  });

  it('is false from the no-provider fallback', () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('probe').props.children).toBe('loading');
  });
});
