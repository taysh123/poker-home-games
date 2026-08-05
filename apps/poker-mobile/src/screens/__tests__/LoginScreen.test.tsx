import { readFileSync } from 'fs';
import { join } from 'path';

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import LoginScreen from '../LoginScreen';
import * as mockedStorage from '../../utils/storage';

// ── Mocks: hermetic render (no reanimated/moti/expo natives, no real storage) ──

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Storage: the guest link READS hasSeenOnboarding but must NEVER write
// (guest-data preservation — same contract the Welcome chooser is pinned to).
let mockStoredOnboarding: string | null = null;
jest.mock('../../utils/storage', () => ({
  getItemAsync: jest.fn((key: string) =>
    Promise.resolve(key === 'hasSeenOnboarding' ? mockStoredOnboarding : null),
  ),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: jest.fn(), googleLogin: jest.fn() }),
}));
jest.mock('../../hooks/useGoogleAuth', () => ({
  // ready:false hides the Google section entirely — not under test here.
  useGoogleAuth: () => ({ prompt: jest.fn(), ready: false }),
}));
jest.mock('../../components/GoogleAuthButton', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View /> };
});

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

function makeNavigation({ routesBeneath = ['Welcome'] }: { routesBeneath?: string[] } = {}) {
  return {
    navigate: jest.fn(),
    reset: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(false),
    getState: jest.fn().mockReturnValue({
      routes: [...routesBeneath.map(name => ({ name })), { name: 'Login' }],
    }),
  } as any;
}

async function renderLogin({ navigation = makeNavigation() } = {}) {
  render(<LoginScreen navigation={navigation} route={{ key: 'login', name: 'Login' } as any} />);
  // Flush the mount-time hasSeenOnboarding read before interacting.
  await act(async () => {});
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStoredOnboarding = null;
});

describe('LoginScreen — guest escape hatch', () => {
  it('renders the "Continue as guest" link alongside the sign-in form', async () => {
    await renderLogin();
    expect(screen.getByText('Sign In')).toBeTruthy();
    expect(screen.getByText('Continue as guest')).toBeTruthy();
  });

  it('returning guest (onboarding seen): resets straight to MainTabs', async () => {
    mockStoredOnboarding = 'true';
    const nav = await renderLogin();
    fireEvent.press(screen.getByText('Continue as guest'));
    expect(nav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
  });

  it('first run: routes through the onboarding funnel', async () => {
    mockStoredOnboarding = null;
    const nav = await renderLogin();
    fireEvent.press(screen.getByText('Continue as guest'));
    expect(nav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Onboarding' }] });
  });

  it('never writes storage — guest local data is untouched', async () => {
    const nav = await renderLogin();
    fireEvent.press(screen.getByText('Continue as guest'));
    expect(mockedStorage.setItemAsync).not.toHaveBeenCalled();
    expect(mockedStorage.deleteItemAsync).not.toHaveBeenCalled();
    expect(nav.reset).toHaveBeenCalled();
  });

  it('a11y: the guest link exposes a button role with an accessible name', async () => {
    await renderLogin();
    expect(screen.getByRole('button', { name: /continue as guest/i })).toBeTruthy();
  });

  it('a11y: "Stay signed in" is a checkbox that reports its own state', async () => {
    // It was a bare TouchableOpacity: no role at all, so it announced as plain text and its
    // checked/unchecked state — the entire point of the control — was never conveyed. This is the
    // one control on this screen that decides whether the session survives a restart.
    await renderLogin();
    const box = screen.getByRole('checkbox', { name: 'Stay signed in' });
    expect(box.props.accessibilityState).toMatchObject({ checked: true }); // defaults on
    expect(screen.getByText('Stay signed in')).toBeTruthy(); // spoken name matches what is shown
  });

  it('a11y: toggling "Stay signed in" flips the announced state, not just the tick', async () => {
    // Pins the STATE against the interaction. A checkbox whose accessibilityState never changes is
    // indistinguishable, to a screen reader, from one that does nothing.
    await renderLogin();
    fireEvent.press(screen.getByRole('checkbox', { name: 'Stay signed in' }));
    expect(screen.getByRole('checkbox', { name: 'Stay signed in' }).props.accessibilityState)
      .toMatchObject({ checked: false });
  });

  it('a11y: the flat aria-checked twin exists in source — a rendered test cannot see it', () => {
    // Mutation-confirmed hole: jest-expo runs REAL react-native, not react-native-web, and RN's
    // own View.js merges the flat prop into accessibilityState via
    // `checked: ariaChecked ?? accessibilityState?.checked` before any test can read it. That
    // means deleting `aria-checked` while `accessibilityState={{ checked: rememberMe }}` survives
    // makes EVERY test above still pass — the merge silently backfills the identical value, so a
    // render assertion cannot tell "twin present" from "twin absent" in this environment. The one
    // place the twin actually matters — react-native-web, which drops accessibilityState entirely
    // and reads only the flat prop — is never exercised by a jest-expo render. A source check is
    // the only thing that can catch its removal, and it is the same tradeoff this repo already
    // accepted for GroupsListScreen's wiring pin (utils/__tests__/groupRow.test.ts).
    const src = readFileSync(join(__dirname, '..', 'LoginScreen.tsx'), 'utf8');
    expect(src).toMatch(/aria-checked=\{\s*rememberMe\s*\}/);
  });

  it('guest already inside the app (modal over MainTabs): dismisses, never resets their place', async () => {
    const nav = await renderLogin({ navigation: makeNavigation({ routesBeneath: ['MainTabs'] }) });
    fireEvent.press(screen.getByText('Continue as guest'));
    expect(nav.goBack).toHaveBeenCalled();
    expect(nav.reset).not.toHaveBeenCalled();
  });

  it('invite flow beneath (JoinSession): dismisses back to the invite, never resets', async () => {
    const nav = await renderLogin({ navigation: makeNavigation({ routesBeneath: ['MainTabs', 'JoinSession'] }) });
    fireEvent.press(screen.getByText('Continue as guest'));
    expect(nav.goBack).toHaveBeenCalled();
    expect(nav.reset).not.toHaveBeenCalled();
  });

  it('race pin: tapping guest before the storage read resolves uses the safe MainTabs arm', async () => {
    // Never-resolving read — simulates a fast tap on a slow device.
    (mockedStorage.getItemAsync as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
    const navigation = makeNavigation();
    render(<LoginScreen navigation={navigation} route={{ key: 'login', name: 'Login' } as any} />);
    fireEvent.press(screen.getByText('Continue as guest'));
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
  });
});
