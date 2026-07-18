import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';
// Platform-split loader: `lottieView.web.ts` shadows `lottieView.ts` on web so
// lottie-react-native (whose web entry needs an unshipped optional peer) is kept
// out of the web bundle entirely.
import { getLottieView } from './lottieView';

type Props = {
  /** Lottie JSON source (require(...) or { uri }). */
  source: any;
  /** Auto-play on mount (native only). Default true. */
  autoPlay?: boolean;
  /** Loop the animation (native only). Default true. */
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Static fallback rendered when motion is suppressed (reduced motion OR web).
   * Should visually stand in for the animation's resting frame — e.g. an Image
   * or an Ionicon. Defaults to an empty (sized) View.
   */
  poster?: React.ReactNode;
};

/**
 * Cross-platform host for a Lottie animation.
 *
 * - Reduced motion OR web  → render the static `poster` (no Lottie at all).
 * - Native + motion allowed → play the Lottie; if the module can't load it
 *   gracefully falls back to `poster` instead of crashing.
 */
export default function LottieHost({
  source,
  autoPlay = true,
  loop = true,
  style,
  poster = null,
}: Props) {
  const reduced = useReducedMotion();
  const useStatic = reduced || Platform.OS === 'web';

  if (useStatic) {
    return <View style={style}>{poster}</View>;
  }

  const LottieView = getLottieView();
  if (!LottieView) {
    return <View style={style}>{poster}</View>;
  }

  return <LottieView source={source} autoPlay={autoPlay} loop={loop} style={style} />;
}
