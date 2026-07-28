/**
 * Screen-facing helper for review presentation surfaces. Reports the protected block's position
 * in VIEWPORT space so the host can decide whether the sheet would cover it.
 *
 * Uses `measureInWindow`, not `onLayout`. This matters: `onLayout`'s `layout.y` is relative to the
 * immediate PARENT, and on both summary screens the settlements block sits inside a
 * ContentContainer nested in a ScrollView — so an onLayout-derived Y is offset by an unknown
 * amount and the occlusion check would be quietly wrong. `measureInWindow` returns window
 * coordinates, which is exactly the space `regionState` reasons in.
 *
 * Usage on a surface WITH protected content (a settlements list):
 *   const review = useReviewSurface('game_summary');
 *   <ScrollView onScroll={review.onScroll} scrollEventThrottle={16}>
 *     <View ref={review.protectedRef} onLayout={review.onProtectedLayout}>…settlements…</View>
 *
 * Usage on a surface with nothing to protect (drill results): call it and ignore the handlers —
 * arming alone is enough, and `canPresentNow` then gates on dwell only.
 *
 * `armed` exists because a screen may mount long before it becomes a presentation surface: the
 * trainer renders its results branch only after the drill finishes, and arming at mount would
 * start the dwell clock while the user is still answering questions.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useWindowDimensions, type View } from 'react-native';
import type { DwellSurface } from '../logic/reviewPromptLogic';
import { useReviewPrompt } from './ReviewPromptContext';

export function useReviewSurface(surface: DwellSurface, armed: boolean = true) {
  const { armSurface, setProtectedRect } = useReviewPrompt();
  const { height: viewportH } = useWindowDimensions();
  const protectedRef = useRef<View>(null);
  const viewportRef = useRef(viewportH);

  useEffect(() => { viewportRef.current = viewportH; }, [viewportH]);

  useEffect(() => {
    if (!armed) return;
    armSurface(surface);
    return () => armSurface(null);
  }, [surface, armed, armSurface]);

  /** Measures the protected block in window space and publishes it to the host. */
  const measure = useCallback(() => {
    const node = protectedRef.current;
    if (!node) return;
    node.measureInWindow((_x, y, _w, h) => {
      // A collapsed/unmounted node measures as zero height — publish nothing rather than a
      // bogus zero-height rect that would read as "not intersecting" and unblock the sheet.
      if (h <= 0) return;
      setProtectedRect({ top: y, bottom: y + h, viewportH: viewportRef.current });
    });
  }, [setProtectedRect]);

  const onProtectedLayout = useCallback(() => { measure(); }, [measure]);
  const onScroll = useCallback(() => { measure(); }, [measure]);

  return { protectedRef, onProtectedLayout, onScroll };
}
