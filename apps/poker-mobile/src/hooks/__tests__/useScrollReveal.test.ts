/**
 * Scroll-reveal for the landing sections: a section "plays" once the viewport
 * has scrolled far enough that it's ~80% visible-adjacent. One-way latch —
 * scrolling back up never re-hides. Reduced motion / disabled ⇒ everything
 * revealed immediately (content must never be trapped at opacity 0).
 */
import { renderHook, act } from '@testing-library/react-native';
import { shouldReveal, useScrollReveal } from '../useScrollReveal';

const layoutEvent = (y: number) => ({ nativeEvent: { layout: { x: 0, y, width: 390, height: 600 } } }) as any;
const scrollEvent = (y: number, viewportH = 800) =>
  ({ nativeEvent: { contentOffset: { y }, layoutMeasurement: { height: viewportH }, contentSize: { height: 5000 } } }) as any;

describe('shouldReveal (pure threshold)', () => {
  it('reveals when scrollY + viewport*factor reaches the element top', () => {
    expect(shouldReveal({ scrollY: 0, viewportH: 800, elementY: 2000, factor: 0.8 })).toBe(false);
    expect(shouldReveal({ scrollY: 1360, viewportH: 800, elementY: 2000, factor: 0.8 })).toBe(true);
    expect(shouldReveal({ scrollY: 1359, viewportH: 800, elementY: 2000, factor: 0.8 })).toBe(false);
  });

  it('elements already above the fold reveal with zero scrolling', () => {
    expect(shouldReveal({ scrollY: 0, viewportH: 800, elementY: 300, factor: 0.8 })).toBe(true);
  });
});

describe('useScrollReveal', () => {
  it('below-fold sections stay hidden until scrolled to, then reveal', () => {
    const { result } = renderHook(() => useScrollReveal({ viewportH: 800 }));
    act(() => { result.current.register('features')(layoutEvent(2000)); });
    expect(result.current.isRevealed('features')).toBe(false);
    act(() => { result.current.onScroll(scrollEvent(900)); });
    expect(result.current.isRevealed('features')).toBe(false);
    act(() => { result.current.onScroll(scrollEvent(1400)); });
    expect(result.current.isRevealed('features')).toBe(true);
  });

  it('one-way latch: scrolling back up never re-hides a revealed section', () => {
    const { result } = renderHook(() => useScrollReveal({ viewportH: 800 }));
    act(() => { result.current.register('s')(layoutEvent(1500)); });
    act(() => { result.current.onScroll(scrollEvent(1200)); });
    expect(result.current.isRevealed('s')).toBe(true);
    act(() => { result.current.onScroll(scrollEvent(0)); });
    expect(result.current.isRevealed('s')).toBe(true);
  });

  it('above-fold sections reveal from their layout event alone (no scroll needed)', () => {
    const { result } = renderHook(() => useScrollReveal({ viewportH: 800 }));
    act(() => { result.current.register('hero-adjacent')(layoutEvent(200)); });
    expect(result.current.isRevealed('hero-adjacent')).toBe(true);
  });

  it('disabled (reduced motion): everything is revealed immediately', () => {
    const { result } = renderHook(() => useScrollReveal({ viewportH: 800, disabled: true }));
    act(() => { result.current.register('deep')(layoutEvent(4000)); });
    expect(result.current.isRevealed('deep')).toBe(true);
    expect(result.current.isRevealed('never-registered')).toBe(true);
  });

  it('unknown keys default to hidden (until their layout registers)', () => {
    const { result } = renderHook(() => useScrollReveal({ viewportH: 800 }));
    expect(result.current.isRevealed('not-yet')).toBe(false);
  });
});
