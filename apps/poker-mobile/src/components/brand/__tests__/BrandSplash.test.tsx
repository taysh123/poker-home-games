import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

// Reanimated → official mock (shared values apply instantly; no native driver).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// OS reduce-motion, controllable per test (flip + rerender to simulate async resolve).
let mockReduced = false;
jest.mock('../../../hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduced }));

import BrandSplash from '../BrandSplash';
import { SPLASH } from '../splashTimeline';

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  mockReduced = false;
});
afterEach(() => {
  jest.useRealTimers();
});

describe('BrandSplash — lifecycle (invariant 4: skippable, idempotent, reduced-motion safe)', () => {
  it('fires onDone exactly once, at TOTAL', () => {
    const onDone = jest.fn();
    render(<BrandSplash onDone={onDone} />);
    advance(SPLASH.TOTAL - 1);
    expect(onDone).not.toHaveBeenCalled();
    advance(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    advance(5000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('tap-to-skip finishes after SKIP_EXIT and the original timer never double-fires', () => {
    const onDone = jest.fn();
    render(<BrandSplash onDone={onDone} />);
    advance(300);
    fireEvent.press(screen.getByLabelText('Skip intro'));
    advance(SPLASH.SKIP_EXIT + 1);
    expect(onDone).toHaveBeenCalledTimes(1);
    advance(SPLASH.TOTAL);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('taps during the exit fade NEVER extend the splash (finish stays at TOTAL)', () => {
    const onDone = jest.fn();
    render(<BrandSplash onDone={onDone} />);
    advance(SPLASH.EXIT_AT + 50); // exit fade in flight
    fireEvent.press(screen.getByLabelText('Skip intro'));
    fireEvent.press(screen.getByLabelText('Skip intro'));
    advance(SPLASH.TOTAL - SPLASH.EXIT_AT); // reach the original TOTAL
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('rapid double-tap on skip completes once', () => {
    const onDone = jest.fn();
    render(<BrandSplash onDone={onDone} />);
    advance(200);
    const skip = screen.getByLabelText('Skip intro');
    fireEvent.press(skip);
    fireEvent.press(skip);
    fireEvent.press(skip);
    advance(SPLASH.TOTAL);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reduced motion: static frame, onDone once at REDUCED_HOLD', () => {
    mockReduced = true;
    const onDone = jest.fn();
    render(<BrandSplash onDone={onDone} />);
    advance(SPLASH.REDUCED_HOLD - 1);
    expect(onDone).not.toHaveBeenCalled();
    advance(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    advance(SPLASH.TOTAL);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reduced motion: tap skips immediately', () => {
    mockReduced = true;
    const onDone = jest.fn();
    render(<BrandSplash onDone={onDone} />);
    fireEvent.press(screen.getByLabelText('Skip intro'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reduce-motion re-arm mid-exit cannot revert the exit or strand the splash', () => {
    const onDone = jest.fn();
    const view = render(<BrandSplash onDone={onDone} />);
    advance(SPLASH.EXIT_AT + 100); // exit fade already in flight
    mockReduced = true; // OS setting resolves/changes late
    view.rerender(<BrandSplash onDone={onDone} />);
    // Must still complete promptly (no 600ms re-hold, no lost finish timer).
    advance(SPLASH.EXIT + SPLASH.SKIP_EXIT + 5);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reduce-motion re-arm after a skip does not resurrect the splash', () => {
    const onDone = jest.fn();
    const view = render(<BrandSplash onDone={onDone} />);
    advance(200);
    fireEvent.press(screen.getByLabelText('Skip intro'));
    advance(SPLASH.SKIP_EXIT + 1);
    expect(onDone).toHaveBeenCalledTimes(1);
    mockReduced = true;
    view.rerender(<BrandSplash onDone={onDone} />);
    advance(SPLASH.TOTAL);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
