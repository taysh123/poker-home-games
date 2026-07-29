import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Speaks a form error on iOS, where the live-region props do nothing.
 *
 * PAIR IT WITH `accessibilityLiveRegion="polite"` + `accessibilityRole="alert"` on the error node.
 * Neither half covers all three platforms:
 *  - iOS   — RN maps the alert role to `UIAccessibilityTraitNone` and ships NO implementation of
 *            `accessibilityLiveRegion` (no `liveRegion` anywhere under `React/`). This hook is the
 *            only thing that speaks.
 *  - Android / web — the props work. This hook is deliberately iOS-ONLY so those platforms do not
 *            announce twice, which an unconditional version caused.
 *
 * ⚠️ LIMIT, stated because a test can look like it covers this and does not: the hook fires on a
 * CHANGE of `error`. If a call site sets the identical error string twice in a row, React bails out
 * of the re-render and nothing announces — so a second failed submit is silent. Handlers that can
 * repeat a message must clear it first in a separate commit, or announce imperatively. The
 * "re-announces after clearing" test below pins the HOOK's behaviour, not any call site's.
 */
export function useAnnouncedError(error: string | null | undefined): void {
  const announced = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (Platform.OS === 'ios' && error && error !== announced.current) {
      AccessibilityInfo.announceForAccessibility?.(error);
    }
    announced.current = error;
  }, [error]);
}
