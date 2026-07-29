import { useEffect, useRef, type MutableRefObject } from 'react';

/**
 * Keeps a ref pointing at the newest render's value.
 *
 * WHY: a long-lived `useCallback` that captures state reads that state forever at its captured
 * value. The obvious repair — add it to the dependency array — changes the callback's identity,
 * and where that callback feeds a `useFocusEffect` (both `SessionScreen.load` and
 * `StatsScreen.load` do) the effect re-fires and calls the loader again. In SessionScreen the
 * loader is what SETS the captured value, so the naive fix is a reload loop: a stale read traded
 * for an infinite one.
 *
 * Reading through this ref gives the callback a stable identity AND a current value, so neither
 * failure mode is available.
 *
 * Deliberately assigns in an effect rather than during render: a render can be thrown away
 * (StrictMode double-render, Suspense retry) and mutating a ref during render would publish a
 * value that was never committed.
 *
 * TWO CAVEATS THAT FAIL SILENTLY — read before using:
 *
 * 1. **Declare it ABOVE any effect that reads the ref.** Passive effects flush in declaration
 *    order, so a `useLatest` declared below a reader gives that reader the previous commit's
 *    value on the render where it changed. Nothing enforces this; it is placement discipline.
 * 2. **Do not read `.current` during render** — it lags by one commit by construction. This is
 *    for values read inside callbacks, effects, timers and async continuations. The generic name
 *    invites the render-time read; that read is wrong.
 */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
