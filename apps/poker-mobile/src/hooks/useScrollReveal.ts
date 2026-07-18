/**
 * Scroll-triggered reveal for long marketing/landing pages (web-parity: plain
 * onScroll + onLayout — no IntersectionObserver, no Reanimated scroll handlers).
 *
 * Sections register their content-column Y via `register(key)` (an onLayout
 * handler) and reveal once the viewport has scrolled to within `factor` of a
 * screen of them. Reveals are a ONE-WAY latch: scrolling back never re-hides.
 *
 * `disabled` (pass the OS reduce-motion flag): every key reports revealed
 * immediately — held-at-opacity-0 content must never be unreachable.
 *
 * Feed the result into the motion recipes' `play` gate:
 *   const reveal = useScrollReveal({ disabled: reduced });
 *   <ScrollView onScroll={reveal.onScroll} scrollEventThrottle={16}>
 *     <View onLayout={reveal.register('live')}>
 *       <MotiView {...slideUpSequence({ reduced, play: reveal.isRevealed('live') })}>
 */
import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useWindowDimensions } from 'react-native';

export function shouldReveal(opts: {
  scrollY: number;
  viewportH: number;
  elementY: number;
  factor?: number;
}): boolean {
  const { scrollY, viewportH, elementY, factor = 0.8 } = opts;
  return scrollY + viewportH * factor >= elementY;
}

export function useScrollReveal(opts?: {
  /** Trigger point as a fraction of the viewport height (default 0.8). */
  factor?: number;
  /** Reveal everything immediately (reduced motion / tests). */
  disabled?: boolean;
  /** Viewport height override — defaults to the window height. */
  viewportH?: number;
}) {
  const { factor = 0.8, disabled = false, viewportH } = opts ?? {};
  const windowH = useWindowDimensions().height;
  const viewport = useRef(viewportH ?? windowH);
  if (viewportH == null) viewport.current = windowH;

  const positions = useRef<Record<string, number>>({});
  const scrollY = useRef(0);
  const [revealed, setRevealed] = useState<Record<string, true>>({});

  const evaluate = useCallback(() => {
    const next: string[] = [];
    for (const [key, y] of Object.entries(positions.current)) {
      if (shouldReveal({ scrollY: scrollY.current, viewportH: viewport.current, elementY: y, factor })) {
        next.push(key);
      }
    }
    if (next.length) {
      setRevealed(prev => {
        if (next.every(k => prev[k])) return prev; // no change — keep the reference stable
        const merged: Record<string, true> = { ...prev };
        for (const k of next) merged[k] = true;
        return merged;
      });
    }
  }, [factor]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    if (e.nativeEvent.layoutMeasurement?.height) {
      viewport.current = e.nativeEvent.layoutMeasurement.height;
    }
    evaluate();
  }, [evaluate]);

  const register = useCallback((key: string) => (e: LayoutChangeEvent) => {
    positions.current[key] = e.nativeEvent.layout.y;
    evaluate();
  }, [evaluate]);

  const isRevealed = useCallback(
    (key: string) => disabled || revealed[key] === true,
    [disabled, revealed],
  );

  return { onScroll, register, isRevealed };
}
