import React from 'react';
import { render, screen } from '@testing-library/react-native';

// ── Mocks: keep the render hermetic (no real navigation / billing / auth) ──

// AsyncStorage is used by pendingCheckout (imported by LandingScreen).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../../features/premium/state/PremiumContext', () => ({
  usePremium: () => ({ isPremium: false, purchasing: false, purchase: jest.fn() }),
}));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
// BrandHeader pulls safe-area + navigation internals — stub to a label.
jest.mock('../../components/BrandHeader', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>T POKER</Text> };
});
// @expo/vector-icons depends on expo-asset which is unavailable in the test env.
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Ionicons: ({ name, testID }: { name?: string; testID?: string }) => (
      <View testID={testID ?? `icon-${name}`} />
    ),
  };
});
// expo-linear-gradient is not available in jsdom — stub to a plain View wrapper.
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...rest }: any) => <View {...rest}>{children}</View>,
  };
});
// Motion layer → plain Views (recipes stay real — they're pure; moti ships ESM).
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
// Jest runs on the native platform, which resolves the empty native image stub —
// substitute bundler asset ids so the <Image> branches render like on web.
jest.mock('../../features/landing/landingImages', () => ({
  landingImages: {
    liveCash: 1, settle: 2, tournament: 3, stats: 4,
    studyLibrary: 5, spotTrainer: 6, aiCoach: 7,
  },
  LANDING_IMAGE_WIDTH: 780,
  LANDING_IMAGE_HEIGHT: 1688,
}));

import { fireEvent } from '@testing-library/react-native';
import LandingScreen from '../LandingScreen';
import {
  PREMIUM_STUDY_BENEFIT,
  LANDING_TRUST_LINE,
  LANDING_SECTIONS,
  LANDING_FAQ,
} from '../../features/landing/landingContent';
import { PRICING } from '../../features/premium/config';

describe('LandingScreen (web)', () => {
  beforeAll(() => {
    Object.defineProperty(require('react-native').Platform, 'OS', {
      value: 'web',
      writable: true,
      configurable: true,
    });
  });

  it('renders the approved hero: headline, chooser CTAs, and the always-visible trust line', () => {
    render(<LandingScreen />);
    expect(screen.getByText('Your home game, handled.')).toBeTruthy();
    expect(screen.getByText('Start a free game')).toBeTruthy();
    expect(screen.getByText('Sign in')).toBeTruthy();
    expect(screen.getByText(LANDING_TRUST_LINE)).toBeTruthy();
  });

  it('hero wiring: "Start a free game" opens the game wizard; "Sign in" opens Login (unchanged contracts)', () => {
    render(<LandingScreen />);
    fireEvent.press(screen.getByText('Start a free game'));
    expect(mockNavigate).toHaveBeenCalledWith('LocalNewGame', { mode: 'cash' });
    fireEvent.press(screen.getByText('Sign in'));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('renders all 4 feature sections with headings and accessible screenshots', () => {
    render(<LandingScreen />);
    for (const s of LANDING_SECTIONS) {
      expect(screen.getByText(s.eyebrow)).toBeTruthy();
      expect(screen.getByText(s.heading)).toBeTruthy();
      expect(screen.getByLabelText(s.imageAlt)).toBeTruthy();
    }
  });

  it('store pills: pre-launch "Coming soon" state, no links (badge licensing)', () => {
    render(<LandingScreen />);
    expect(screen.getByLabelText('Coming soon to the App Store')).toBeTruthy();
    expect(screen.getByLabelText('Coming soon to Google Play')).toBeTruthy();
    expect(screen.getAllByText('Coming soon to')).toHaveLength(2);
    expect(screen.queryByText('Get it on')).toBeNull();
  });

  it('FAQ is an accordion: questions visible, answers collapsed until tapped', () => {
    render(<LandingScreen />);
    const first = LANDING_FAQ[0];
    expect(screen.getByText(first.q)).toBeTruthy();
    expect(screen.queryByText(first.a)).toBeNull();
    fireEvent.press(screen.getByText(first.q));
    expect(screen.getByText(first.a)).toBeTruthy();
  });

  it('renders both prices from PRICING', () => {
    render(<LandingScreen />);
    expect(
      screen.getAllByText(new RegExp(PRICING.monthly.price.replace('$', '\\$'))).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(new RegExp(PRICING.yearly.price.replace('$', '\\$'))).length,
    ).toBeGreaterThan(0);
  });

  it('shows the live Premium Study benefit verbatim', () => {
    render(<LandingScreen />);
    // PREMIUM_STUDY_BENEFIT appears in the "Between Sessions" lead AND the shared benefit list.
    expect(screen.getAllByText(PREMIUM_STUDY_BENEFIT).length).toBeGreaterThan(0);
  });

  it('renders at least one Soon chip', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Soon').length).toBeGreaterThan(0);
  });

  it('renders the legal footer (privacy, terms, 18+/not-gambling)', () => {
    render(<LandingScreen />);
    expect(screen.getByText('Privacy')).toBeTruthy();
    expect(screen.getByText('Terms')).toBeTruthy();
    // 18+/not-gambling now appears in BOTH the hero trust line and the footer disclaimer.
    expect(screen.getAllByText(/18\+/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/not a gambling product/i).length).toBeGreaterThanOrEqual(2);
  });

  it('a11y: exposes accessible link roles for the legal links', () => {
    render(<LandingScreen />);
    // The footer legal links are rendered with accessibilityRole="link".
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(2);
  });

  it('honesty: pricing CTAs are present but no Soon row carries its own CTA', () => {
    render(<LandingScreen />);
    // Card-level CTA exists (live offer)…
    expect(screen.getAllByText(/Get Premium/i).length).toBeGreaterThan(0);
    // …and "Soon" only ever appears as a chip label, never inside a purchase button.
    const buyButtons = screen.getAllByText(/Get Premium/i);
    buyButtons.forEach(node => {
      const label = Array.isArray(node.props.children)
        ? node.props.children.join('')
        : String(node.props.children ?? '');
      expect(label).not.toMatch(/Soon/i);
    });
  });
});
