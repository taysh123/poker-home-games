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

import LandingScreen from '../LandingScreen';
import { PREMIUM_STUDY_BENEFIT } from '../../features/landing/landingContent';
import { PRICING } from '../../features/premium/config';

describe('LandingScreen (web)', () => {
  beforeAll(() => {
    Object.defineProperty(require('react-native').Platform, 'OS', {
      value: 'web',
      writable: true,
      configurable: true,
    });
  });

  it('renders the hero headline', () => {
    render(<LandingScreen />);
    expect(screen.getByText(/Run the night/i)).toBeTruthy();
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
    expect(screen.getByText(/18\+/)).toBeTruthy();
    expect(screen.getByText(/not a gambling product/i)).toBeTruthy();
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
