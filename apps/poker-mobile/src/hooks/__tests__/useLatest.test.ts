import { renderHook } from '@testing-library/react-native';
import { useLatest } from '../useLatest';

/**
 * Pins the mechanism both stale-closure fixes rely on.
 *
 * The bug class: a long-lived `useCallback` captures a state value, the value changes, and the
 * callback keeps reading the stale one forever. The obvious repair — add it to the dependency
 * array — changes the callback's identity, and in both screens that callback feeds a
 * `useFocusEffect`, so the "fix" re-triggers the very load that sets the value. A reload loop
 * traded for a stale read.
 *
 * `useLatest` sidesteps both: the callback keeps a stable identity AND always reads current.
 */
describe('useLatest', () => {
  it('exposes the initial value', () => {
    const { result } = renderHook(() => useLatest('first'));
    expect(result.current.current).toBe('first');
  });

  it('tracks the newest value across rerenders', () => {
    const { result, rerender } = renderHook(({ v }) => useLatest(v), {
      initialProps: { v: 'first' },
    });
    rerender({ v: 'second' });
    expect(result.current.current).toBe('second');
    rerender({ v: 'third' });
    expect(result.current.current).toBe('third');
  });

  it('keeps a STABLE ref object identity across rerenders', () => {
    // This is the half that makes it safe in a dependency array: the ref never invalidates a
    // useCallback, so no focus effect re-fires.
    const { result, rerender } = renderHook(({ v }) => useLatest(v), {
      initialProps: { v: 1 },
    });
    const first = result.current;
    rerender({ v: 2 });
    expect(result.current).toBe(first);
  });

  it('tracks null and undefined rather than treating them as "no update"', () => {
    // The StatsScreen case reads `user?.userId`, which is legitimately undefined when signed out.
    // A naive "only update when truthy" implementation would keep the previous user's id — the
    // exact identity-crossing this fix exists to prevent.
    const { result, rerender } = renderHook(({ v }) => useLatest(v), {
      initialProps: { v: 'u1' as string | undefined },
    });
    rerender({ v: undefined });
    expect(result.current.current).toBeUndefined();
  });
});
