/** Tracks the OS "reduce motion" accessibility setting (V2.1 STEP 4). */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Web can answer SYNCHRONOUSLY via matchMedia, so a reduce-motion user there never sees a frame
 * of motion. Native has no sync API (`isReduceMotionEnabled()` is a promise), so the first value
 * is unavoidably `false` — which let the launch splash play its opening frames before the
 * setting resolved (Q1.2 substrate: an accessibility defect, not a cosmetic one). Motion that
 * must not leak should use `useReducedMotionState()` and hold until `ready`.
 */
function initialReduced(): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }
  return false;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(initialReduced);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then(v => { if (mounted) setReduced(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduced(!!v));
    return () => { mounted = false; sub?.remove?.(); };
  }, []);

  return reduced;
}

/**
 * `{ reduced, ready }` — `ready` flips once the OS setting has actually been READ (immediately on
 * web, after the async probe on native). A choreography that would otherwise leak its opening
 * frames to a reduce-motion user holds until `ready`.
 */
export function useReducedMotionState(): { reduced: boolean; ready: boolean } {
  const [state, setState] = useState(() => ({
    reduced: initialReduced(),
    ready: Platform.OS === 'web', // web resolved synchronously above
  }));

  useEffect(() => {
    let mounted = true;
    // Identity-preserving: a reduceMotionChanged emission with no actual change must not
    // re-render every consumer.
    const settle = (v: boolean) => {
      if (mounted) setState(s => (s.reduced === !!v && s.ready ? s : { reduced: !!v, ready: true }));
    };
    // Defensive: if the API is absent the optional call yields undefined, and chaining .then on
    // it would throw synchronously and leave `ready` false forever — which now gates the launch.
    const probe = AccessibilityInfo.isReduceMotionEnabled?.();
    if (probe && typeof probe.then === 'function') {
      probe.then(settle).catch(() => { if (mounted) setState(s => ({ ...s, ready: true })); });
    } else if (mounted) {
      setState(s => ({ ...s, ready: true })); // no API — proceed unreduced
    }
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => settle(v));
    return () => { mounted = false; sub?.remove?.(); };
  }, []);

  return state;
}
