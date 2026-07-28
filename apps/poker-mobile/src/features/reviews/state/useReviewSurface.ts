/**
 * Screen-facing helper for review presentation surfaces. Converts ScrollView geometry into the
 * viewport-space rect the host needs, so screens never do the arithmetic themselves.
 *
 * Usage on a surface WITH protected content (a settlements list):
 *   const review = useReviewSurface('game_summary');
 *   <ScrollView onScroll={review.onScroll} scrollEventThrottle={16} onLayout={review.onViewportLayout}>
 *     <View onLayout={review.onProtectedLayout}>…settlements…</View>
 *
 * Usage on a surface with nothing to protect (drill results): call it and ignore the handlers —
 * arming alone is enough, and `canPresentNow` then gates on dwell only.
 *
 * `armed` exists because a screen may mount long before it becomes a presentation surface: the
 * trainer renders its results branch only after the drill finishes, and arming at mount would
 * start the dwell clock while the user is still answering questions.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { DwellSurface } from '../logic/reviewPromptLogic';
import { useReviewPrompt } from './ReviewPromptContext';

export function useReviewSurface(surface: DwellSurface, armed: boolean = true) {
  const { armSurface, setProtectedRect } = useReviewPrompt();
  const sectionY = useRef<number | null>(null);
  const sectionH = useRef(0);
  const scrollY = useRef(0);
  const viewportH = useRef(0);

  useEffect(() => {
    if (!armed) return;
    armSurface(surface);
    return () => armSurface(null);
  }, [surface, armed, armSurface]);

  const publish = useCallback(() => {
    if (sectionY.current === null || viewportH.current === 0) return;
    const top = sectionY.current - scrollY.current;
    setProtectedRect({ top, bottom: top + sectionH.current, viewportH: viewportH.current });
  }, [setProtectedRect]);

  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    viewportH.current = e.nativeEvent.layout.height;
    publish();
  }, [publish]);

  const onProtectedLayout = useCallback((e: LayoutChangeEvent) => {
    sectionY.current = e.nativeEvent.layout.y;
    sectionH.current = e.nativeEvent.layout.height;
    publish();
  }, [publish]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    publish();
  }, [publish]);

  return { onViewportLayout, onProtectedLayout, onScroll };
}
