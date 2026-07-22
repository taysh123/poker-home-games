/**
 * Quiet Luxury funnel (Wave 1, slices 1.1+1.2) — the behavioral contract of the FIRST
 * IMPRESSION screen. Pins: promise → goal → skill → format → name → router flow; every answer
 * commits via PersonaContext + emits a typed funnel event; the exit contract (markSeen THEN
 * navigation.reset) on every path; Skip preserves already-answered steps; the router leads with
 * the user's goal; a11y roles on every option; and the PRIVACY rule — the typed name NEVER
 * appears in any analytics call.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockSetItemAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('../../utils/storage', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockTrack = jest.fn();
jest.mock('../../utils/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
  markSignupIntent: jest.fn().mockResolvedValue(undefined),
}));

const mockAnswerStep = jest.fn().mockResolvedValue(undefined);
const mockCompleteFunnel = jest.fn().mockResolvedValue(undefined);
let mockPersonaGoal: string | null = null;
jest.mock('../../features/persona/state/PersonaContext', () => ({
  usePersona: () => ({
    persona: mockPersonaGoal ? { goal: mockPersonaGoal } : null,
    isLoaded: true,
    answerStep: (...args: unknown[]) => mockAnswerStep(...args),
    completeFunnel: (...args: unknown[]) => mockCompleteFunnel(...args),
  }),
}));

// Prod-like flags: study ON, bankroll/coach OFF (router shows Play + Study cards only).
jest.mock('../../config/features', () => ({
  isFeatureEnabled: (flag: string) => flag === 'study',
}));

jest.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true })); // instant advance — no beat timers in tests
jest.mock('../../components/motion/PressableScale', () => {
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (props: any) => <Pressable {...props} /> };
});
jest.mock('../../components/motion', () => {
  const { View, Pressable } = require('react-native');
  const recipes = jest.requireActual('../../components/motion/recipes');
  return {
    __esModule: true,
    ...recipes,
    MotiView: ({ children, ...rest }: any) => <View {...rest}>{children}</View>,
    PressableScale: (props: any) => <Pressable {...props} />,
  };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: ({ children, ...rest }: any) => <View {...rest}>{children}</View> };
});
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: ({ name }: { name?: string }) => <View testID={`icon-${name}`} /> };
});

import OnboardingV2Screen from '../OnboardingV2Screen';

function makeNavigation() {
  return { reset: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn().mockReturnValue(false) } as any;
}
function renderFunnel(navigation = makeNavigation()) {
  render(<OnboardingV2Screen navigation={navigation} route={{ key: 'o', name: 'Onboarding' } as any} />);
  return navigation;
}
const answerThrough = async (labels: string[]) => {
  for (const label of labels) {
    await act(async () => { fireEvent.press(screen.getByText(label)); });
  }
};

describe('Quiet Luxury funnel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPersonaGoal = null;
  });

  it('opens on the promise screen — headline, pillar sub-lines, CTA, quiet skip', () => {
    renderFunnel();
    expect(screen.getByText('Win your home game.')).toBeTruthy();
    expect(screen.getByText(/Study daily\. Run the night\. Know your numbers\./)).toBeTruthy();
    expect(screen.getByText("Let's set you up")).toBeTruthy();
    expect(screen.getByLabelText('Skip onboarding')).toBeTruthy();
    expect(mockTrack).toHaveBeenCalledWith('onboarding_started');
  });

  it('walks promise → goal → skill → format → name, committing + tracking each answer (ids only)', async () => {
    renderFunnel();
    await act(async () => { fireEvent.press(screen.getByText("Let's set you up")); });
    expect(screen.getByText('What brings you to the table?')).toBeTruthy();

    await answerThrough(['I want to win more']);
    expect(mockAnswerStep).toHaveBeenCalledWith('goal', 'improve');
    expect(mockTrack).toHaveBeenCalledWith('funnel_step_answered', { step: 'goal', answer: 'improve' });
    expect(screen.getByText('How sharp is your game?')).toBeTruthy();

    await answerThrough(['I hold my own']);
    expect(mockAnswerStep).toHaveBeenCalledWith('skill', 'solid');
    expect(screen.getByText('What do you play?')).toBeTruthy();

    await answerThrough(['Tournaments']);
    expect(mockAnswerStep).toHaveBeenCalledWith('format', 'tournament');
    expect(screen.getByText('What should we call you?')).toBeTruthy();
  });

  it('name step: typing + continue records the name locally but NEVER sends it to analytics', async () => {
    renderFunnel();
    await act(async () => { fireEvent.press(screen.getByText("Let's set you up")); });
    await answerThrough(['I want to win more', 'I hold my own', 'Tournaments']);

    fireEvent.changeText(screen.getByPlaceholderText('Your name (optional)'), 'Tay Shofer');
    await act(async () => { fireEvent.press(screen.getByText('Continue')); });

    expect(mockAnswerStep).toHaveBeenCalledWith('name', 'Tay Shofer'); // local store — allowed
    expect(mockCompleteFunnel).toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith('funnel_completed', expect.objectContaining({ named: true }));
    // THE privacy pin: the typed name appears in NO analytics call, ever.
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('Tay Shofer');
    expect(screen.getByText('Where do you want to start?')).toBeTruthy(); // router reached
  });

  it('"Skip this" on the name step completes unnamed', async () => {
    renderFunnel();
    await act(async () => { fireEvent.press(screen.getByText("Let's set you up")); });
    await answerThrough(['I host the game', 'Newer to poker', 'Cash games']);
    await act(async () => { fireEvent.press(screen.getByText('Skip this')); });
    expect(mockTrack).toHaveBeenCalledWith('funnel_completed', expect.objectContaining({ named: false }));
    expect(screen.getByText('Where do you want to start?')).toBeTruthy();
  });

  it('Back walks one step back; the promise step has no back', async () => {
    renderFunnel();
    expect(screen.queryByLabelText('Back')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByText("Let's set you up")); });
    await answerThrough(['I host the game']);
    expect(screen.getByText('How sharp is your game?')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText('Back')); });
    expect(screen.getByText('What brings you to the table?')).toBeTruthy();
  });

  it('Skip mid-quiz keeps answered steps, marks seen, and resets to MainTabs', async () => {
    const nav = renderFunnel();
    await act(async () => { fireEvent.press(screen.getByText("Let's set you up")); });
    await answerThrough(['I want to win more']); // one answer committed already
    await act(async () => { fireEvent.press(screen.getByLabelText('Skip onboarding')); });

    expect(mockAnswerStep).toHaveBeenCalledWith('goal', 'improve'); // partial persona retained
    expect(mockSetItemAsync).toHaveBeenCalledWith('hasSeenOnboarding', 'true');
    await waitFor(() => expect(nav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] }));
    expect(mockTrack).toHaveBeenCalledWith('onboarding_skipped', expect.objectContaining({ from: 'quiz' }));
  });

  it('router: choosing an action marks seen and resets with the target stacked on MainTabs', async () => {
    const nav = renderFunnel();
    await act(async () => { fireEvent.press(screen.getByText("Let's set you up")); });
    await answerThrough(['I host the game', 'Newer to poker', 'Cash games']);
    await act(async () => { fireEvent.press(screen.getByText('Skip this')); });

    await act(async () => { fireEvent.press(screen.getByText('Start a game')); });
    expect(mockSetItemAsync).toHaveBeenCalledWith('hasSeenOnboarding', 'true');
    await waitFor(() => expect(nav.reset).toHaveBeenCalledWith(
      expect.objectContaining({ index: 1, routes: expect.arrayContaining([expect.objectContaining({ name: 'MainTabs' })]) }),
    ));
    expect(mockTrack).toHaveBeenCalledWith('onboarding_completed', expect.objectContaining({ via: 'play' }));
  });

  it('router leads with the goal: improvers see Drill a spot first, hosts see Start a game first', async () => {
    mockPersonaGoal = 'improve';
    renderFunnel();
    await act(async () => { fireEvent.press(screen.getByText("Let's set you up")); });
    await answerThrough(['I want to win more', 'I hold my own', 'Both']);
    await act(async () => { fireEvent.press(screen.getByText('Skip this')); });

    const drill = screen.getByText('Drill a spot');
    const start = screen.getByText('Start a game');
    // Render order pin: the improver's first card is Study.
    expect(JSON.stringify(screen.toJSON()).indexOf('Drill a spot'))
      .toBeLessThan(JSON.stringify(screen.toJSON()).indexOf('Start a game'));
    expect(drill).toBeTruthy();
    expect(start).toBeTruthy();
  });

  it('a11y: every option card exposes a button role with an accessible name', async () => {
    renderFunnel();
    await act(async () => { fireEvent.press(screen.getByText("Let's set you up")); });
    expect(screen.getByRole('button', { name: /I host the game/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /I want to win more/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Both, honestly/i })).toBeTruthy();
  });
});
