/**
 * Placement drill screen (slice 1.4). Pins the contract that makes an UNMETERED run honest:
 * no answers/explanations are ever shown during the run (assessment, not practice), the result
 * records ONE placement + measured skill, nothing touches the study meters, and it exits back
 * to wherever it was launched from.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

const mockRecordPlacement = jest.fn().mockResolvedValue(undefined);
jest.mock('../../state/PersonaContext', () => ({
  usePersona: () => ({ persona: null, isLoaded: true, recordPlacement: mockRecordPlacement }),
}));

const mockTrack = jest.fn();
jest.mock('../../../../utils/analytics', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));

// A pool with a clean difficulty spread; every question's correct answer is 'A'.
const mockRows = [
  ...Array.from({ length: 8 }, (_, i) => ({ QuizID: `b${i}`, Category: 'RFI', Difficulty: 'Beginner', Question: `Beginner ${i}?`, OptionA: 'Right', OptionB: 'Wrong', CorrectAnswer: 'A', Explanation: 'because', FreeOrPremium: 'Free' })),
  ...Array.from({ length: 8 }, (_, i) => ({ QuizID: `i${i}`, Category: 'RFI', Difficulty: 'Intermediate', Question: `Intermediate ${i}?`, OptionA: 'Right', OptionB: 'Wrong', CorrectAnswer: 'A', Explanation: 'because', FreeOrPremium: 'Free' })),
  ...Array.from({ length: 8 }, (_, i) => ({ QuizID: `a${i}`, Category: 'RFI', Difficulty: 'Advanced', Question: `Advanced ${i}?`, OptionA: 'Right', OptionB: 'Wrong', CorrectAnswer: 'A', Explanation: 'because', FreeOrPremium: 'Free' })),
];
// STABLE query identity (the real ContentContext memoizes it — a fresh object per render would
// re-fire the load effect forever).
const mockQuery = { all: jest.fn().mockResolvedValue(mockRows) };
jest.mock('../../../../context/ContentContext', () => ({
  useContent: () => ({ enabled: true, isLoaded: true, query: mockQuery }),
}));

// A study-meter spy: the drill must NEVER consume quiz/practice allowance.
const mockRecordQuizFinished = jest.fn();
const mockRecordPracticeAnswer = jest.fn();
jest.mock('../../../study/state/StudyContext', () => ({
  useStudy: () => ({
    limitFor: () => ({ allowed: true, remaining: 10 }),
    recordQuizFinished: mockRecordQuizFinished,
    recordPracticeAnswer: mockRecordPracticeAnswer,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock('../../../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../../../components/motion/PressableScale', () => {
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (props: any) => <Pressable {...props} /> };
});
jest.mock('../../../../components/motion', () => {
  const { View, Pressable } = require('react-native');
  const recipes = jest.requireActual('../../../../components/motion/recipes');
  return { __esModule: true, ...recipes, MotiView: ({ children, ...r }: any) => <View {...r}>{children}</View>, PressableScale: (p: any) => <Pressable {...p} /> };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: ({ children, ...r }: any) => <View {...r}>{children}</View> };
});
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: ({ name }: { name?: string }) => <View testID={`icon-${name}`} /> };
});

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

import PlacementDrillScreen from '../PlacementDrillScreen';

/** Render and flush the content-load promise (findBy* polling can't advance under fake timers). */
const renderDrill = async () => {
  render(<PlacementDrillScreen />);
  await act(async () => {});
};

const start = async () => { await act(async () => { fireEvent.press(screen.getByText('Start')); }); };

const answerAll = async (correct: number) => {
  for (let i = 0; i < 5; i++) {
    await act(async () => { fireEvent.press(screen.getByText(i < correct ? 'Right' : 'Wrong')); });
  }
};

describe('PlacementDrillScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.all.mockResolvedValue(mockRows); // re-arm after clearAllMocks
  });

  it('opens on an honest intro: five questions, no answers shown, skippable', async () => {
    await renderDrill();
    expect(screen.getAllByText('Find your level').length).toBeGreaterThan(0);
    expect(screen.getByText(/five quick questions/i)).toBeTruthy();
    expect(screen.getByText(/we won't show the answers/i)).toBeTruthy(); // why it's unmetered
    expect(screen.getByLabelText('Not now')).toBeTruthy();
  });

  it('runs five questions WITHOUT ever revealing an answer or explanation', async () => {
    await renderDrill();
    await start();

    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(`Question ${i + 1} of 5`)).toBeTruthy();
      expect(screen.queryByText('because')).toBeNull();       // no explanation, ever
      expect(screen.queryByText(/correct/i)).toBeNull();      // no verdict, ever
      await act(async () => { fireEvent.press(screen.getByText('Right')); });
    }
    expect(screen.getByText('Sharp already')).toBeTruthy(); // 5/5 â‡’ grinder result copy
  });

  it('records exactly one placement with the score, and NEVER touches the study meters', async () => {
    await renderDrill();
    await start();
    await answerAll(3);

    expect(mockRecordPlacement).toHaveBeenCalledTimes(1);
    expect(mockRecordPlacement).toHaveBeenCalledWith(3, 5);
    expect(mockRecordQuizFinished).not.toHaveBeenCalled();
    expect(mockRecordPracticeAnswer).not.toHaveBeenCalled();
  });

  it('the result is encouraging, states the level is changeable, and offers a real next step', async () => {
    await renderDrill();
    await start();
    await answerAll(0);

    expect(screen.getByText('Starting with the fundamentals')).toBeTruthy();
    expect(screen.getByText(/change it anytime/i)).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Start drilling')); });
    expect(mockNavigate).toHaveBeenCalledWith('StudyTrainer', { mode: 'spot' });
  });

  it('"Not now" exits without recording anything', async () => {
    await renderDrill();
    await act(async () => { fireEvent.press(screen.getByLabelText('Not now')); });
    expect(mockGoBack).toHaveBeenCalled();
    expect(mockRecordPlacement).not.toHaveBeenCalled();
  });

  it('tracks start and completion with the score only (no question content)', async () => {
    await renderDrill();
    await start();
    await answerAll(4);

    expect(mockTrack).toHaveBeenCalledWith('placement_started');
    expect(mockTrack).toHaveBeenCalledWith('placement_completed', { score: 4, total: 5, skill: 'grinder' });
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('Beginner 0?');
  });
});


