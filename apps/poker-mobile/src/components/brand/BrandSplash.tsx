import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

/**
 * Dual-brand launch splash: True Story Labs → T Poker, then `onDone`.
 * Rendered as a full-screen overlay above the navigator in App.tsx; the app mounts
 * underneath while this plays. Uses shared-value opacity/scale only (web-safe — no
 * layout animations). The TSL frame uses the real logo asset with a typographic
 * wordmark fallback if the image is ever unavailable.
 */

// Real brand assets (bundled by Metro). Wrapped so a missing file degrades to the wordmark.
let TSL_LOGO: number | null = null;
try { TSL_LOGO = require('../../../assets/true-story-labs-logo.png'); } catch { TSL_LOGO = null; }
const TPOKER_LOGO = require('../../../assets/logo.png');

const AImage = Reanimated.createAnimatedComponent(Image);

type Props = { onDone: () => void };

// Timeline (ms): TSL in → hold → out → T Poker in → hold → done.
const TSL_IN = 380;
const TSL_HOLD = 1150;
const TSL_OUT = 320;
const TP_IN = 400;
const TP_HOLD = 1050;
const TP_START = TSL_IN + TSL_HOLD + TSL_OUT; // when T Poker begins
const TOTAL = TP_START + TP_IN + TP_HOLD;

export default function BrandSplash({ onDone }: Props) {
  const tslOpacity = useSharedValue(0);
  const tslScale = useSharedValue(0.94);
  const tpOpacity = useSharedValue(0);
  const tpScale = useSharedValue(0.94);

  useEffect(() => {
    // True Story Labs — fade/scale in, hold, fade out.
    tslOpacity.value = withTiming(1, { duration: TSL_IN });
    tslScale.value = withTiming(1, { duration: TSL_IN + 220 });
    tslOpacity.value = withDelay(TSL_IN + TSL_HOLD, withTiming(0, { duration: TSL_OUT }));

    // T Poker — fade/scale in after the handoff, then hold.
    tpOpacity.value = withDelay(TP_START, withTiming(1, { duration: TP_IN }));
    tpScale.value = withDelay(TP_START, withTiming(1, { duration: TP_IN + 240 }));

    const timer = setTimeout(onDone, TOTAL);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tslStyle = useAnimatedStyle(() => ({
    opacity: tslOpacity.value,
    transform: [{ scale: tslScale.value }],
  }));
  const tpStyle = useAnimatedStyle(() => ({
    opacity: tpOpacity.value,
    transform: [{ scale: tpScale.value }],
  }));

  return (
    <View style={styles.root} pointerEvents="none">
      <Reanimated.View style={[styles.frame, tslStyle]}>
        {TSL_LOGO ? (
          <AImage source={TSL_LOGO} style={styles.tslLogo} resizeMode="contain" />
        ) : (
          <View style={styles.wordmarkWrap}>
            <Text style={styles.wordmark}>TRUE STORY LABS</Text>
          </View>
        )}
      </Reanimated.View>

      <Reanimated.View style={[styles.tpFrame, tpStyle]}>
        <Image source={TPOKER_LOGO} style={styles.tpLogo} resizeMode="contain" />
        <Text style={styles.tagline}>YOUR HOME GAME, HANDLED</Text>
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundDeep,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  // Both frames are centered overlays so the second cross-fades in over the first.
  frame: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  tslLogo: { width: 240, height: 132 },
  tpFrame: { position: 'absolute', alignItems: 'center' },
  tpLogo: { width: 168, height: 168 },
  tagline: { ...typography.caps, color: colors.goldMuted, letterSpacing: 2.5, marginTop: 4 },
  wordmarkWrap: { alignItems: 'center' },
  wordmark: {
    ...typography.h3,
    color: colors.goldLight,
    letterSpacing: 3,
  },
});
