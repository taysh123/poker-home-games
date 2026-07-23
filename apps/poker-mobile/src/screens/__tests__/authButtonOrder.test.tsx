import React from 'react';
import { render, screen, act } from '@testing-library/react-native';

// Hermetic render — BOTH auth providers forced available so we can assert their ORDER.
// Guideline 4.8 (and Apple's HIG) want Sign in with Apple to be at least as prominent as
// other third-party sign-in buttons; on a 4.8.0 resubmission we pin it ABOVE Google.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../utils/storage', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn(),
    register: jest.fn(),
    googleLogin: jest.fn(),
    appleLogin: jest.fn(),
  }),
}));
// Both providers ON — the whole point is that BOTH buttons render together.
jest.mock('../../hooks/useGoogleAuth', () => ({
  useGoogleAuth: () => ({ prompt: jest.fn(), ready: true }),
}));
jest.mock('../../hooks/useAppleAuth', () => ({
  useAppleAuth: () => ({ prompt: jest.fn(), available: true }),
}));
// Identify each provider button by accessibilityLabel; getAllByTestId returns tree order.
jest.mock('../../components/GoogleAuthButton', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="auth-provider-btn" accessibilityLabel="google" /> };
});
jest.mock('../../components/AppleAuthButton', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="auth-provider-btn" accessibilityLabel="apple" /> };
});
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

import LoginScreen from '../LoginScreen';
import RegisterScreen from '../RegisterScreen';

function makeNavigation() {
  return {
    navigate: jest.fn(),
    reset: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(false),
    getState: jest.fn().mockReturnValue({ routes: [{ name: 'Welcome' }] }),
  } as any;
}

const providerOrder = () =>
  screen.getAllByTestId('auth-provider-btn').map(b => b.props.accessibilityLabel);

describe('Sign in with Apple renders ABOVE Google (Guideline 4.8 prominence)', () => {
  it('LoginScreen: Apple first, Google second', async () => {
    render(<LoginScreen navigation={makeNavigation()} route={{ key: 'login', name: 'Login' } as any} />);
    await act(async () => {});
    expect(providerOrder()).toEqual(['apple', 'google']);
  });

  it('RegisterScreen: Apple first, Google second', async () => {
    render(<RegisterScreen navigation={makeNavigation()} route={{ key: 'register', name: 'Register' } as any} />);
    await act(async () => {});
    expect(providerOrder()).toEqual(['apple', 'google']);
  });
});
