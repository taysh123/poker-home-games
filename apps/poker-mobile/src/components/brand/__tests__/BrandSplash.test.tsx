import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

// Reanimated → official mock (shared values apply instantly; no native driver).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// OS reduce-motion, controllable per test (flip + rerender to simulate async resolve).
// `mockMotionReady` models the native probe: the splash must NOT start until the setting is
// actually read (Q1.2 — it used to leak opening frames to reduce-motion users). Default true so
// the existing lifecycle pins below read unchanged.
let mockReduced = false;
let mockMotionReady = true;
jest.mock('../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReduced,
  useReducedMotionState: () => ({ reduced: mockReduced, ready: mockMotionReady }),
}));

import BrandSplash from '../BrandSplash';
import { SPLASH } from '../splashTimeline';

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  mockReduced = false;
  mockMotionReady = true;
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

  it('holds until the OS motion preference is READ — no animated frames leak to a reduce-motion user', () => {
    // Native resolves `isReduceMotionEnabled()` asynchronously. Before Q1.2 the splash started
    // its choreography immediately with the default `false`, so a reduce-motion user saw the
    // opening frames before it snapped to the static frame.
    mockMotionReady = false;
    const onDone = jest.fn();
    const view = render(<BrandSplash onDone={onDone} />);
    advance(SPLASH.TOTAL * 2);
    expect(onDone).not.toHaveBeenCalled(); // nothing started, nothing finished

    // Probe resolves: reduce-motion user gets the static frame on the short clock.
    mockReduced = true;
    mockMotionReady = true;
    view.rerender(<BrandSplash onDone={onDone} />);
    advance(SPLASH.REDUCED_HOLD + 1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('once the preference resolves to "no reduction", the full choreography runs its normal clock', () => {
    mockMotionReady = false;
    const onDone = jest.fn();
    const view = render(<BrandSplash onDone={onDone} />);
    advance(500);
    mockMotionReady = true; // resolves: not reduced
    view.rerender(<BrandSplash onDone={onDone} />);
    advance(SPLASH.TOTAL - 1);
    expect(onDone).not.toHaveBeenCalled();
    advance(2);
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

describe('BrandSplash — reveal (Q1.2: the screen rises THROUGH the dissolve, not after it)', () => {
  it('fires onReveal when the exit fade STARTS, ~300ms before onDone', () => {
    const onReveal = jest.fn();
    const onDone = jest.fn();
    render(<BrandSplash onReveal={onReveal} onDone={onDone} />);
    advance(SPLASH.EXIT_AT - 1);
    expect(onReveal).not.toHaveBeenCalled();
    advance(2);
    expect(onReveal).toHaveBeenCalledTimes(1); // gate opens as the fade begins
    expect(onDone).not.toHaveBeenCalled();     // overlay still fading — do NOT unmount yet
    advance(SPLASH.EXIT);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a skip reveals immediately too — the gate is never stranded behind a shortcut', () => {
    const onReveal = jest.fn();
    const onDone = jest.fn();
    render(<BrandSplash onReveal={onReveal} onDone={onDone} />);
    advance(200);
    fireEvent.press(screen.getByLabelText('Skip intro'));
    expect(onReveal).toHaveBeenCalledTimes(1);
    advance(SPLASH.SKIP_EXIT + 1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reduced motion still reveals exactly once (no fade to ride)', () => {
    mockReduced = true;
    const onReveal = jest.fn();
    const onDone = jest.fn();
    render(<BrandSplash onReveal={onReveal} onDone={onDone} />);
    advance(SPLASH.REDUCED_HOLD + 1);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('onReveal never fires twice, even with taps during the fade', () => {
    const onReveal = jest.fn();
    render(<BrandSplash onReveal={onReveal} onDone={jest.fn()} />);
    advance(SPLASH.EXIT_AT + 10);
    fireEvent.press(screen.getByLabelText('Skip intro'));
    fireEvent.press(screen.getByLabelText('Skip intro'));
    advance(SPLASH.TOTAL);
    expect(onReveal).toHaveBeenCalledTimes(1);
  });
});
