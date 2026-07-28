import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

/**
 * THE brand lockup — badge + wordmark (+ optional rule/tagline), rendered by both the launch
 * splash and the Welcome screen (Q1.2 choreography).
 *
 * WHY IT EXISTS: those two surfaces drew the same brand from two hand-maintained copies and had
 * already drifted — 26px vs 24px wordmark, framed tile vs bare badge, ALL-CAPS gold tagline vs
 * sentence-case muted one — so a user saw "one brand" as three different things in ~2.5s. One
 * component with a `scale` variant makes divergence impossible by construction; changing the
 * lockup now changes it everywhere.
 *
 * Purely presentational: no motion, no state. Callers own animation (the splash animates its
 * parts, Welcome staggers the block), which keeps this safe on web and under reduced motion.
 */
export type BrandLockupScale = 'splash' | 'screen';

interface Props {
  scale: BrandLockupScale;
  /** 'tagline' = the splash's caps line; 'rule' = Welcome's rule + sentence-case line. */
  footer?: 'none' | 'tagline' | 'rule';
  /** Welcome frames the badge in a gold-tinted tile; the splash shows it bare on the deep navy. */
  framed?: boolean;
  /** Render slots so callers can animate individual parts (the splash fades them separately). */
  renderBadge?: (badge: React.ReactNode) => React.ReactNode;
  renderWordmark?: (wordmark: React.ReactNode) => React.ReactNode;
  renderFooter?: (footer: React.ReactNode) => React.ReactNode;
}

const SIZES = {
  splash: { badge: 148, radius: 0, wordmark: 26 },
  screen: { badge: 84, radius: 20, wordmark: 24 },
} as const;

const identity = (n: React.ReactNode) => n;

export default function BrandLockup({
  scale,
  footer = 'none',
  framed = false,
  renderBadge = identity,
  renderWordmark = identity,
  renderFooter = identity,
}: Props) {
  const s = SIZES[scale];

  const badgeImage = (
    <Image
      source={require('../../../assets/logo.png')}
      style={{ width: s.badge, height: s.badge, borderRadius: s.radius }}
      resizeMode="contain"
    />
  );

  const badge = framed ? (
    <View style={styles.frame}>
      <View style={[styles.frameInner, { width: s.badge, height: s.badge, borderRadius: s.radius }]}>
        {badgeImage}
      </View>
    </View>
  ) : (
    badgeImage
  );

  const wordmark = (
    <Text
      style={[styles.wordmark, { fontSize: s.wordmark, marginTop: framed ? 0 : 18 }]}
      accessibilityRole="header"
    >
      T POKER
    </Text>
  );

  const footerNode =
    footer === 'tagline' ? (
      <Text style={styles.tagline}>YOUR HOME GAME, HANDLED</Text>
    ) : footer === 'rule' ? (
      <View style={styles.footerRuleWrap}>
        <View style={styles.rule} />
        <Text style={styles.sentenceTagline}>Your home game, handled.</Text>
      </View>
    ) : null;

  return (
    <View style={styles.root}>
      {renderBadge(badge)}
      {renderWordmark(wordmark)}
      {footerNode ? renderFooter(footerNode) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  frame: {
    width: 100,
    height: 100,
    borderRadius: 26,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...shadows.gold,
  },
  frameInner: { overflow: 'hidden' },
  wordmark: {
    ...typography.displaySerif,
    color: colors.goldLight,
    letterSpacing: 4,
  },
  tagline: {
    ...typography.caps,
    color: colors.goldMuted,
    letterSpacing: 2.5,
    marginTop: 8,
  },
  footerRuleWrap: { alignItems: 'center', marginTop: spacing.sm },
  rule: {
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.goldMuted,
    marginBottom: spacing.lg,
  },
  sentenceTagline: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
