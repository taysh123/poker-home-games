import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Speaks a form error when it appears, and again if it returns after clearing.
 *
 * WHY THIS IS NOT JUST `accessibilityLiveRegion`: those props cover Android and web and cover
 * NOTHING on iOS. React Native maps `accessibilityRole="alert"` to `UIAccessibilityTraitNone`, and
 * ships no iOS implementation of `accessibilityLiveRegion` at all. Relying on them alone left auth
 * failures silent on the platform this app shipped on first — behind a comment asserting they were
 * announced. Pair this hook WITH the props; neither covers all three platforms alone.
 *
 * Re-announcing after a clear matters: submitting twice with the same mistake must speak twice, or
 * the second attempt reads as a silent success.
 */
export function useAnnouncedError(error: string | null | undefined): void {
  const announced = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (error && error !== announced.current) {
      AccessibilityInfo.announceForAccessibility?.(error);
    }
    announced.current = error;
  }, [error]);
}
