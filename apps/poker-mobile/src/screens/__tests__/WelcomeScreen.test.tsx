import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ── Mocks: hermetic render (no reanimated/moti/expo natives, no real storage) ──

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Storage must NEVER be written by the chooser (guest-data preservation).
jest.mock('../../utils/storage', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockTrack = jest.fn();
const mockMarkSignupIntent = jest.fn().mockResolvedValue(undefined);
const mockGrantAnalyticsConsent = jest.fn().mockResolvedValue(undefined);
jest.mock('../../utils/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
  markSignupIntent: (...args: unknown[]) => mockMarkSignupIntent(...args),
  grantAnalyticsConsent: (...args: unknown[]) => mockGrantAnalyticsConsent(...args),
}));

// Local games context — overridden per test via mockGames/mockActiveGame.
let mockGames: unknown[] = [];
let mockActiveGame: unknown = null;
jest.mock('../../context/LocalGamesContext', () => ({
  useLocalGames: () => ({ games: mockGames, activeGame: mockActiveGame }),
}));

// Motion layer → plain Views (recipes stay real — they're pure).
jest.mock('../../components/motion/PressableScale', () => {
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (props: any) => <Pressable {...props} /> };
});
jest.mock('../../components/motion', () => {
  const { View } = require('react-native');
  const recipes = jest.requireActual('../../components/motion/recipes');
  return {
    __esModule: true,
    ...recipes,
    MotiView: ({ children, ...rest }: any) => <View {...rest}>{children}</View>,
  };
});
jest.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: ({ children, ...rest }: any) => <View {...rest}>{children}</View> };
});
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: ({ name }: { name?: string }) => <View testID={`icon-${name}`} /> };
});

import WelcomeScreen from '../WelcomeScreen';
import * as mockedStorage from '../../utils/storage';

function makeNavigation() {
  return {
    navigate: jest.fn(),
    reset: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(false),
  } as any;
}

function renderWelcome({ firstRun = false, navigation = makeNavigation() } = {}) {
  render(<WelcomeScreen navigation={navigation} route={{ key: 'welcome', name: 'Welcome', params: { firstRun } } as any} />);
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGames = [];
  mockActiveGame = null;
});

describe('WelcomeScreen — brand + chooser', () => {
  it('renders the wordmark, tagline, both CTAs, legal line, and byline', () => {
    renderWelcome();
    expect(screen.getByText('T POKER')).toBeTruthy();
    expect(screen.getByText('Your home game, handled.')).toBeTruthy();
    expect(screen.getByText('Continue as guest')).toBeTruthy();
    expect(screen.getByText('Sign in')).toBeTruthy();
    expect(screen.getByText(/18\+/)).toBeTruthy();
    expect(screen.getByText(/not a gambling/i)).toBeTruthy();
    expect(screen.getByText('BY TRUE STORY LABS')).toBeTruthy();
  });

  it('returning guest: "Continue as guest" resets straight to MainTabs', () => {
    const nav = renderWelcome({ firstRun: false });
    fireEvent.press(screen.getByText('Continue as guest'));
    expect(nav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
  });

  it('first run: "Continue as guest" routes through the onboarding funnel', () => {
    const nav = renderWelcome({ firstRun: true });
    fireEvent.press(screen.getByText('Continue as guest'));
    expect(nav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Onboarding' }] });
  });

  it('both chooser arms grant analytics consent — the explicit choice IS the consent boundary', () => {
    // Wave 0.2 (spec decision 5): the Welcome choice is the moment analytics may initialize.
    // Nothing sends before it — pinned for real (unmocked module) in analyticsDispatch.test.ts.
    renderWelcome();
    expect(mockGrantAnalyticsConsent).not.toHaveBeenCalled(); // rendering alone is NOT consent
    fireEvent.press(screen.getByText('Continue as guest'));
    expect(mockGrantAnalyticsConsent).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('Sign in'));
    expect(mockGrantAnalyticsConsent).toHaveBeenCalledTimes(2);
  });

  it('never writes guest data — secure storage AND AsyncStorage (local games) untouched', () => {
    // markSignupIntent (Sign-in arm) and the analytics consent marker are analytics-only
    // attribution/consent writes and are mocked out above; the guarantee pinned here is about
    // GUEST DATA: the keys the local-games store and onboarding gate live under are never
    // written or cleared.
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const nav = renderWelcome({ firstRun: false });
    fireEvent.press(screen.getByText('Continue as guest'));
    fireEvent.press(screen.getByText('Sign in'));
    expect(mockedStorage.setItemAsync).not.toHaveBeenCalled();
    expect(mockedStorage.deleteItemAsync).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(AsyncStorage.clear).not.toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
    expect(nav.reset).toHaveBeenCalled();
  });

  it('"Sign in" opens the Login modal and marks signup intent', () => {
    const nav = renderWelcome();
    fireEvent.press(screen.getByText('Sign in'));
    expect(mockMarkSignupIntent).toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith('Login');
  });

  it('tracks the chooser funnel (shown / guest / sign-in)', () => {
    const nav = renderWelcome();
    expect(mockTrack).toHaveBeenCalledWith('welcome_shown', expect.anything());
    fireEvent.press(screen.getByText('Continue as guest'));
    expect(mockTrack).toHaveBeenCalledWith('welcome_guest', expect.anything());
    fireEvent.press(screen.getByText('Sign in'));
    expect(mockTrack).toHaveBeenCalledWith('welcome_signin', expect.anything());
    expect(nav.navigate).toHaveBeenCalled();
  });

  it('shows the on-device reassurance line only when local games exist', () => {
    mockGames = [{ id: 'g1' }];
    renderWelcome();
    expect(screen.getByText('Your games are saved on this device.')).toBeTruthy();
  });

  it('hides the reassurance line for brand-new users', () => {
    renderWelcome();
    expect(screen.queryByText('Your games are saved on this device.')).toBeNull();
  });

  it('a11y: both CTAs expose button roles with accessible names', () => {
    renderWelcome();
    expect(screen.getByRole('button', { name: /continue as guest/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });
});
