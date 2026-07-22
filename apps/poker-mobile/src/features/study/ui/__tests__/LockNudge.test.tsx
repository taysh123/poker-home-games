/**
 * LockNudge — the single honest lock/limit surface. Pins (Wave 0.2):
 *   1. an impression event fires exactly ONCE per mount with the typed trigger id
 *      (the E-workstream measurement foundation), and
 *   2. the honesty gate: with `paywall` OFF the coming-soon body renders and there is NO
 *      purchase CTA (no "See Premium").
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

const mockTrack = jest.fn();
jest.mock('../../../../utils/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

let mockPaywallOn = false;
jest.mock('../../../../config/features', () => ({
  isFeatureEnabled: (flag: string) => (flag === 'paywall' ? mockPaywallOn : true),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: (props: { name?: string }) => <View testID={`icon-${props.name}`} /> };
});

import LockNudge from '../LockNudge';

describe('LockNudge — impression + honesty gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPaywallOn = false;
  });

  it('fires nudge_impression exactly once per mount with the trigger id', () => {
    const { rerender } = render(
      <LockNudge title="Daily free limit reached" comingSoonBody="Resets at midnight." upgradeBody="Go unlimited." trigger="quiz_daily_limit" />,
    );
    rerender(
      <LockNudge title="Daily free limit reached" comingSoonBody="Resets at midnight." upgradeBody="Go unlimited." trigger="quiz_daily_limit" />,
    );
    const impressions = mockTrack.mock.calls.filter(c => c[0] === 'nudge_impression');
    expect(impressions).toHaveLength(1);
    expect(impressions[0][1]).toMatchObject({ trigger: 'quiz_daily_limit', paywallOn: false });
  });

  it('paywall OFF: renders the coming-soon body and NO purchase CTA', () => {
    render(
      <LockNudge title="Premium pack" comingSoonBody="Unlimited practice is coming soon." upgradeBody="Upgrade now." trigger="trainer_daily_limit" />,
    );
    expect(screen.getByText('Unlimited practice is coming soon.')).toBeTruthy();
    expect(screen.queryByText('See Premium')).toBeNull();
    expect(screen.queryByText('Upgrade now.')).toBeNull();
  });
});
