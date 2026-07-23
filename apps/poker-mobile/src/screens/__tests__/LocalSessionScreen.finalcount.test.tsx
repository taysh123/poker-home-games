import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

// ── Hermetic render harness for the money-critical end-game gate ──
// (First screen test for The Final Count; the shape is reused for SessionScreen in PR B.)

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-0000-0000-000000000000' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));
jest.mock('../../utils/currency', () => ({
  ...jest.requireActual('../../utils/currency'),
  currencySymbol: () => '₪',
}));
jest.mock('../../config/features', () => ({ isFeatureEnabled: () => false }));
jest.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../utils/haptics', () => ({
  lightTap: jest.fn(), mediumTap: jest.fn(), successNotification: jest.fn(),
}));
jest.mock('../../utils/confirm', () => ({ confirmDialog: jest.fn(), infoDialog: jest.fn() }));
jest.mock('../../components/table/TableScene', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View /> };
});
jest.mock('../../components/ActionSheet', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View /> };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: ({ children, ...rest }: any) => <View {...rest}>{children}</View> };
});
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: ({ name }: { name?: string }) => <View testID={`icon-${name}`} /> };
});
jest.mock('../../components/motion/PressableScale', () => {
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (props: any) => <Pressable {...props} /> };
});
jest.mock('../../components/motion/AnimatedNumber', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, format }: any) => <Text>{format ? format(value) : String(value)}</Text>,
  };
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

// Controllable local-games context. `mock`-prefixed so jest.mock's factory may reference them.
const mockEndGame = jest.fn().mockResolvedValue(undefined);
let mockGames: any[] = [];
jest.mock('../../context/LocalGamesContext', () => ({
  useLocalGames: () => ({
    games: mockGames,
    endGame: mockEndGame,
    addBuyIn: jest.fn(), addCashOut: jest.fn(), addPlayer: jest.fn(), undoLastTxn: jest.fn(),
    eliminatePlayer: jest.fn(), undoElimination: jest.fn(), deleteGame: jest.fn(),
    syncClock: jest.fn(), pauseClock: jest.fn(), resumeClock: jest.fn(), gotoLevel: jest.fn(),
    finishTournamentEarly: jest.fn(),
  }),
}));

import LocalSessionScreen from '../LocalSessionScreen';

/** Active cash game: Alex + Dana each bought in ₪20 ⇒ ₪40 (4000 cents) remaining on the table. */
function activeCashGame() {
  const at = '2026-07-20T20:00:00.000Z';
  return {
    id: 'g1', schemaVersion: 4, name: 'Test Night', status: 'Active', mode: 'cash',
    createdAt: at, updatedAt: at, defaultBuyInCents: 2000,
    players: [{ id: 'alex', name: 'Alex' }, { id: 'dana', name: 'Dana' }],
    txns: [
      { id: 't1', playerId: 'alex', kind: 'buyin', amountCents: 2000, at },
      { id: 't2', playerId: 'dana', kind: 'buyin', amountCents: 2000, at },
    ],
  };
}

function makeNav() {
  return { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn(), popToTop: jest.fn(), setOptions: jest.fn() } as any;
}

function renderScreen(nav = makeNav()) {
  render(<LocalSessionScreen navigation={nav} route={{ key: 'ls', name: 'LocalSession', params: { gameId: 'g1' } } as any} />);
  return nav;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGames = [activeCashGame()];
});

describe('LocalSessionScreen — The Final Count gate (money-critical)', () => {
  it('blocks "End Game & Settle" until the count balances exactly', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('End Game'));
    expect(screen.getByText('The Final Count')).toBeTruthy();

    // No stacks entered → unbalanced (local requires an exact count) → settling is a no-op.
    fireEvent.press(screen.getByRole('button', { name: 'End Game & Settle' }));
    expect(mockEndGame).not.toHaveBeenCalled();

    // Under-count (₪30 of ₪40) stays blocked.
    const inputs = screen.getAllByPlaceholderText('0');
    fireEvent.changeText(inputs[0], '30');
    fireEvent.press(screen.getByRole('button', { name: 'End Game & Settle' }));
    expect(mockEndGame).not.toHaveBeenCalled();
    expect(screen.getByText(/unaccounted for/)).toBeTruthy();
  });

  it('settles with per-player cents and navigates once the count balances', async () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('End Game'));

    const inputs = screen.getAllByPlaceholderText('0');
    fireEvent.changeText(inputs[0], '30'); // Alex ₪30 → 3000
    fireEvent.changeText(inputs[1], '10'); // Dana ₪10 → 1000  (== ₪40 remaining)
    expect(screen.getByText(/Totals match/)).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'End Game & Settle' }));
    });

    expect(mockEndGame).toHaveBeenCalledWith('g1', [
      { playerId: 'alex', amountCents: 3000 },
      { playerId: 'dana', amountCents: 1000 },
    ]);
    expect(nav.replace).toHaveBeenCalledWith('LocalSessionSummary', { gameId: 'g1' });
  });

  it('the override unblocks settling on an intentionally unbalanced count', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('End Game'));

    const inputs = screen.getAllByPlaceholderText('0');
    fireEvent.changeText(inputs[0], '25'); // ₪25 of ₪40 → short, blocked
    fireEvent.press(screen.getByRole('button', { name: 'End Game & Settle' }));
    expect(mockEndGame).not.toHaveBeenCalled();

    // Arm the inline override, then settle.
    fireEvent.press(screen.getByText('End anyway with an unbalanced count'));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'End Game & Settle' }));
    });
    expect(mockEndGame).toHaveBeenCalledWith('g1', [{ playerId: 'alex', amountCents: 2500 }]);
  });
});
