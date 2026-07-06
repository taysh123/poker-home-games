import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Platform,
  Linking,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Chip from '../components/Chip';
import PrimaryButton from '../components/PrimaryButton';
import BrandHeader from '../components/BrandHeader';
import Accordion from '../components/Accordion';
import PressableScale from '../components/motion/PressableScale';
import { MotiView, slideUpSequence } from '../components/motion';
import { useSplashDone } from '../components/brand/SplashGate';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import { usePremium } from '../features/premium/state/PremiumContext';
import { useAuth } from '../context/AuthContext';
import { PRICING, isFeatureLive } from '../features/premium/config';
import { savePendingCheckout, type CheckoutPlan } from '../utils/pendingCheckout';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  LANDING_HERO,
  LANDING_TRUST_LINE,
  LANDING_SECTIONS,
  LANDING_PREMIUM,
  LANDING_STUDY_VALUE,
  PREMIUM_STUDY_BENEFIT,
  landingPlans,
  landingBenefits,
  LANDING_FAQ,
  LANDING_LEGAL_LINKS,
  LANDING_DISCLAIMER,
  STORE_LINKS,
} from '../features/landing/landingContent';
import {
  landingImages,
  LANDING_IMAGE_WIDTH,
  LANDING_IMAGE_HEIGHT,
} from '../features/landing/landingImages';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Anchor-nav destinations (desktop top bar) — keys match section/block anchors. */
const NAV_LINKS: { key: string; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: 'tournament', label: 'Tournament' },
  { key: 'study', label: 'Study' },
  { key: 'coach', label: 'Coach' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'faq', label: 'FAQ' },
];

const IMAGE_ASPECT = LANDING_IMAGE_WIDTH / LANDING_IMAGE_HEIGHT;

/** Ambient accent mapping (approved): eyebrow text needs AA contrast, glows stay faint. */
const ACCENT_TEXT = {
  gold: colors.gold,
  felt: colors.success,
  teal: colors.info,
  purple: colors.aiPurple,
} as const;
const ACCENT_GLOW = {
  gold: colors.goldFaint,
  felt: colors.feltFaint,
  teal: colors.tealGlow,
  purple: colors.aiPurpleFaint,
} as const;

/**
 * Web-only landing (renders null on native) — the web entry at the app root.
 *
 * GTO-Wizard-style structure, Velvet Table identity:
 *   sticky brand bar → minimal full-viewport hero (headline · sub · chooser CTAs
 *   · always-visible trust line) → four one-idea feature sections with real
 *   product screenshots + scroll reveals → compact premium/pricing (honesty
 *   gates + purchase wiring byte-identical) → FAQ accordion → legal footer.
 *
 * Logic contracts preserved: hero primary CTA still starts the free-game wizard;
 * plan CTAs still stash pending checkout → Register (logged out) or purchase()
 * (logged in); "Soon" benefits never gain a buy affordance; Welcome-chooser /
 * splash / routing untouched (resolveWebLanding decides mounting, not this file).
 */
export default function LandingScreen() {
  if (Platform.OS !== 'web') return null;

  /* eslint-disable react-hooks/rules-of-hooks */
  const navigation = useNavigation<Nav>();
  const { isPremium, purchasing, purchase } = usePremium();
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const splashDone = useSplashDone();
  const { width: winW, height: winH } = useWindowDimensions();
  const reveal = useScrollReveal({ disabled: reduced });
  const scrollRef = useRef<ScrollView>(null);
  const anchorsRef = useRef<Record<string, number>>({});
  const columnYRef = useRef(0);
  const [scrolled, setScrolled] = useState(false);
  // Motion pass: one shared scroll clock drives the progress bar + section parallax.
  // This screen is WEB-ONLY, so "worklets" run on the JS thread — plain ref reads
  // inside useAnimatedStyle are safe here (they re-evaluate on every scroll tick).
  const scrollY = useSharedValue(0);
  const contentH = useSharedValue(1);
  const progressStyle = useAnimatedStyle(() => {
    const max = Math.max(1, contentH.value - winH);
    return { transform: [{ scaleX: Math.min(1, Math.max(0, scrollY.value / max)) }] };
  });
  /* eslint-enable react-hooks/rules-of-hooks */

  const wide = winW >= 900;

  async function onChoosePlan(plan: CheckoutPlan) {
    const productId =
      plan === 'yearly' ? PRICING.yearly.productId : PRICING.monthly.productId;
    if (user) {
      await purchase(productId);
      return;
    }
    // Stash intent, send to Register; AppNavigator resumes on null→user transition.
    await savePendingCheckout(plan);
    navigation.navigate('Register');
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    reveal.onScroll(e);
    scrollY.value = e.nativeEvent.contentOffset.y;
    const past = e.nativeEvent.contentOffset.y > 32;
    setScrolled(prev => (prev === past ? prev : past));
  }

  /** One onLayout feeds both the anchor map and the reveal latch. */
  const registerBlock = (key: string) => (e: LayoutChangeEvent) => {
    anchorsRef.current[key] = e.nativeEvent.layout.y;
    reveal.register(key)(e);
  };

  function scrollToAnchor(key: string) {
    const y = anchorsRef.current[key];
    if (y == null) return;
    // Section y is relative to the content column; add the column's own offset
    // and pull back a little so the sticky bar never covers the heading.
    scrollRef.current?.scrollTo({ y: Math.max(0, columnYRef.current + y - 76), animated: !reduced });
  }

  // Hero entrance: staggered once the splash resolves (same gate as Welcome).
  const heroGroup = (delay: number) =>
    slideUpSequence({ reduced, delay, duration: 320, play: splashDone });

  const plans = landingPlans();
  const benefits = landingBenefits();

  return (
    <Screen>
      {/* Scroll-progress hairline — informational (scroll-driven, no autonomous motion). */}
      <Reanimated.View pointerEvents="none" style={[styles.progressBar, progressStyle]} />
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        onScroll={onScroll}
        onContentSizeChange={(_w, h) => { contentH.value = h; }}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Sticky top bar (transparent → solid past the hero top) ── */}
        <View style={[styles.topBar, scrolled && styles.topBarSolid]}>
          <View style={styles.topBarInner}>
            <BrandHeader
              variant="brand"
              right={
                <View style={styles.topBarRight}>
                  {wide &&
                    NAV_LINKS.map(l => (
                      <PressableScale
                        key={l.key}
                        onPress={() => scrollToAnchor(l.key)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Go to ${l.label}`}
                      >
                        <Text style={styles.navLink}>{l.label}</Text>
                      </PressableScale>
                    ))}
                  <PressableScale
                    onPress={() => navigation.navigate('Login')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Sign in"
                  >
                    <Text style={styles.signIn}>Sign in</Text>
                  </PressableScale>
                </View>
              }
            />
          </View>
        </View>

        <View
          style={styles.column}
          onLayout={e => { columnYRef.current = e.nativeEvent.layout.y; }}
        >
          {/* ── 1. Hero — minimal philosophy, richer body: breathing glow layers +
                 (desktop) a floating device mockup of the live table. Mobile keeps
                 the centered hero so the trust line stays above the fold. ── */}
          <View
            style={[
              styles.hero,
              { minHeight: Math.max(520, winH - 140) },
              wide && styles.heroWide,
            ]}
          >
            <HeroGlow reduced={reduced} play={splashDone} />
            <View style={[styles.heroText, wide && styles.heroTextWide]}>
              <MotiView {...heroGroup(0)}>
                <Text style={[styles.heroTitle, wide && styles.heroTitleWide]} accessibilityRole="header">
                  {LANDING_HERO.headline}
                </Text>
              </MotiView>
              <MotiView {...heroGroup(80)}>
                <Text style={[styles.heroSub, wide && styles.heroSubWide]}>{LANDING_HERO.subhead}</Text>
              </MotiView>
              <MotiView {...heroGroup(160)} style={[styles.heroCtas, wide && styles.heroCtasWide]}>
                <PrimaryButton
                  variant="gradient"
                  label={LANDING_HERO.primaryCta}
                  onPress={() => navigation.navigate('LocalNewGame', { mode: 'cash' })}
                  fullWidth={false}
                />
                <PrimaryButton
                  variant="outline"
                  label={LANDING_HERO.secondaryCta}
                  onPress={() => navigation.navigate('Login')}
                  fullWidth={false}
                />
              </MotiView>
              <MotiView {...heroGroup(220)}>
                <Text style={[styles.trustLine, wide && styles.trustLineWide]}>{LANDING_TRUST_LINE}</Text>
              </MotiView>
            </View>
            {wide && landingImages.liveCash != null && (
              <MotiView {...heroGroup(260)} style={styles.heroDeviceCol}>
                <FloatingDevice reduced={reduced} source={landingImages.liveCash as number} />
              </MotiView>
            )}
            <MotiView {...heroGroup(420)} style={styles.scrollCue} pointerEvents="none">
              <Ionicons name="chevron-down" size={iconSize.sm} color={colors.textMuted} />
            </MotiView>
          </View>

          {/* ── 2. Feature sections — one idea each, alternating on desktop ── */}
          {LANDING_SECTIONS.map((s, i) => {
            const played = reveal.isRevealed(s.key);
            return (
              <View
                key={s.key}
                onLayout={registerBlock(s.key)}
                style={[
                  styles.section,
                  wide && (i % 2 === 1 ? styles.sectionRowReverse : styles.sectionRow),
                ]}
              >
                <View style={[styles.sectionText, wide && styles.sectionTextWide]}>
                  <MotiView {...slideUpSequence({ reduced, delay: 0, duration: 320, play: played })}>
                    <View style={[styles.eyebrowRow, !wide && styles.eyebrowRowCentered]}>
                      <Text style={[styles.eyebrow, { color: ACCENT_TEXT[s.accent] }]}>{s.eyebrow}</Text>
                      {s.featureKey != null && (
                        <Chip
                          label={isFeatureLive(s.featureKey) ? 'Premium' : 'Soon'}
                          tone={isFeatureLive(s.featureKey) ? 'gold' : 'neutral'}
                        />
                      )}
                    </View>
                    <MotiView
                      from={{ scaleX: 0 }}
                      animate={{ scaleX: played ? 1 : 0 }}
                      transition={{ type: 'timing', duration: reduced ? 0 : 400, delay: reduced ? 0 : 60 }}
                      style={[
                        styles.eyebrowRule,
                        { backgroundColor: ACCENT_TEXT[s.accent] },
                        !wide && styles.eyebrowRuleCentered,
                      ]}
                    />
                    <Text style={styles.sectionHeading} accessibilityRole="header">
                      {s.heading}
                    </Text>
                  </MotiView>
                  <MotiView {...slideUpSequence({ reduced, delay: 70, duration: 320, play: played })}>
                    <Text style={styles.sectionBody}>{s.body}</Text>
                  </MotiView>
                </View>
                <SectionMedia
                  played={played}
                  reduced={reduced}
                  glow={ACCENT_GLOW[s.accent]}
                  image={landingImages[s.image]}
                  alt={s.imageAlt}
                  scrollY={scrollY}
                  winH={winH}
                  pageY={() => columnYRef.current + (anchorsRef.current[s.key] ?? 0)}
                />
              </View>
            );
          })}

          {/* ── 3. Premium bridge + pricing (wiring byte-identical) ── */}
          <View onLayout={registerBlock('pricing')} style={styles.premiumBlock}>
            <MotiView {...slideUpSequence({ reduced, delay: 0, duration: 320, play: reveal.isRevealed('pricing') })}>
              <Text style={[styles.eyebrow, styles.eyebrowSolo]}>{LANDING_PREMIUM.eyebrow}</Text>
              <Text style={styles.sectionHeading} accessibilityRole="header">
                {LANDING_PREMIUM.heading}
              </Text>
              <Text style={styles.lead}>{PREMIUM_STUDY_BENEFIT}</Text>
            </MotiView>

            <MotiView
              {...slideUpSequence({ reduced, delay: 90, duration: 320, play: reveal.isRevealed('pricing') })}
              style={styles.studyRow}
            >
              {LANDING_STUDY_VALUE.map(v => (
                <View key={v.title} style={styles.studyItem}>
                  <View style={styles.studyIcon}>
                    <Ionicons name={v.icon} size={18} color={colors.gold} />
                  </View>
                  <Text style={styles.studyTitle}>{v.title}</Text>
                  <Text style={styles.studyBody}>{v.body}</Text>
                </View>
              ))}
            </MotiView>

            <MotiView
              {...slideUpSequence({ reduced, delay: 160, duration: 320, play: reveal.isRevealed('pricing') })}
              style={styles.plans}
            >
              {plans.map(p => (
                <Card
                  key={p.key}
                  variant={p.highlighted ? 'hero' : 'flat'}
                  style={styles.planCard}
                >
                  {p.highlighted ? (
                    <Chip label="Best value" tone="gold" style={styles.bestValueChip} />
                  ) : null}
                  <Text style={styles.price}>{p.price}</Text>
                  <Text style={styles.cadence}>{p.cadence}</Text>
                  {p.subline ? <Text style={styles.subline}>{p.subline}</Text> : null}
                  {isPremium ? (
                    <Text style={styles.premiumNote}>You're Premium</Text>
                  ) : (
                    <PrimaryButton
                      variant={p.highlighted ? 'gradient' : 'outline'}
                      loading={purchasing}
                      label={`Get Premium — ${p.price}/${p.key === 'yearly' ? 'yr' : 'mo'}`}
                      onPress={() => onChoosePlan(p.key)}
                    />
                  )}
                </Card>
              ))}
            </MotiView>

            {/* Shared benefit list — rendered ONCE, below the plan cards */}
            <View style={styles.benefitList}>
              {benefits.map(b => (
                <View key={b.title} style={styles.benefitRow}>
                  {b.comingSoon ? (
                    <>
                      <Text style={styles.benefitSoon}>{b.title}</Text>
                      <Chip label="Soon" tone="neutral" />
                    </>
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color={colors.gold} />
                      <Text style={styles.benefitLive}>{b.title}</Text>
                    </>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* ── 4. FAQ accordion ── */}
          <View onLayout={registerBlock('faq')} style={styles.faqBlock}>
            <Text style={[styles.eyebrow, styles.eyebrowSolo]}>FAQ</Text>
            <Text style={styles.sectionHeading} accessibilityRole="header">
              Questions, answered.
            </Text>
            <Accordion
              items={LANDING_FAQ.map(f => ({ id: f.q, title: f.q, body: f.a }))}
            />
          </View>

          {/* ── 5. Footer ── */}
          <View style={styles.footer}>
            <View style={styles.storeRow}>
              <StorePill icon="logo-apple" store="the App Store" url={STORE_LINKS.appStoreUrl} />
              <StorePill icon="logo-google-playstore" store="Google Play" url={STORE_LINKS.playStoreUrl} />
            </View>
            <View style={styles.legalRow}>
              {LANDING_LEGAL_LINKS.map(l => (
                <PressableScale
                  key={l.href}
                  onPress={() => Linking.openURL(l.href)}
                  accessibilityRole="link"
                  accessibilityLabel={l.label}
                >
                  <Text style={styles.legalLink}>{l.label}</Text>
                </PressableScale>
              ))}
            </View>
            <Text style={styles.disclaimer}>{LANDING_DISCLAIMER}</Text>
            <Text style={styles.byline}>BY TRUE STORY LABS</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Three layered radial glows breathing on independent slow clocks (opacity-only,
 * transform-free — no CLS). Reduced motion: static at resting opacity.
 */
function HeroGlow({ reduced }: { reduced: boolean; play?: boolean }) {
  const layers = [
    { style: styles.glowGold, duration: 9000, from: 0.55 },
    { style: styles.glowFelt, duration: 12000, from: 0.4 },
    { style: styles.glowCore, duration: 7000, from: 0.6 },
  ];
  return (
    <>
      {layers.map((l, i) =>
        reduced ? (
          <View key={i} pointerEvents="none" style={l.style} />
        ) : (
          <MotiView
            key={i}
            pointerEvents="none"
            style={l.style}
            from={{ opacity: l.from }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: l.duration, loop: true, repeatReverse: true }}
          />
        ),
      )}
    </>
  );
}

/**
 * Section screenshot with accent glow entrance + gentle scroll parallax (±16px,
 * transform-only). Composes: outer parallax (Reanimated) → inner reveal (Moti).
 * Web-only screen ⇒ the animated style runs on the JS thread, so reading the
 * anchor refs via `pageY()` re-evaluates correctly on every scroll tick.
 * Reduced motion: no parallax, glow + frame appear at rest.
 */
function SectionMedia({ played, reduced, glow, image, alt, scrollY, winH, pageY }: {
  played: boolean;
  reduced: boolean;
  glow: string;
  image: number | undefined;
  alt: string;
  scrollY: SharedValue<number>;
  winH: number;
  pageY: () => number;
}) {
  const parallaxStyle = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ translateY: 0 }] };
    const base = pageY();
    const ty = interpolate(
      scrollY.value,
      [base - winH, base + 800],
      [16, -16],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateY: ty }] };
  });
  return (
    <Reanimated.View style={[styles.sectionMediaWrap, parallaxStyle]}>
      <MotiView
        pointerEvents="none"
        from={{ opacity: 0 }}
        animate={{ opacity: played ? 1 : 0 }}
        transition={{ type: 'timing', duration: reduced ? 0 : 600 }}
        style={[styles.mediaGlow, { backgroundColor: glow }]}
      />
      <MotiView {...slideUpSequence({ reduced, delay: 140, duration: 380, distance: 16, play: played })}>
        {image != null && (
          <View style={styles.deviceFrame}>
            <Image
              source={image}
              style={styles.screenshot}
              resizeMode="cover"
              accessibilityLabel={alt}
            />
          </View>
        )}
      </MotiView>
    </Reanimated.View>
  );
}

/**
 * Store presence, config-driven (see STORE_LINKS): no URL → own-brand "Coming soon"
 * pill (nominative store-name text — official badge artwork is NOT licensed before
 * a live listing); URL set at launch → linked pill, to be swapped for the official
 * self-hosted badge artwork + trademark credit lines.
 */
function StorePill({ icon, store, url }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  store: string;
  url: string | null;
}) {
  const body = (
    <>
      <Ionicons name={icon} size={iconSize.md} color={colors.textHigh} />
      <View>
        <Text style={styles.storePillHint}>{url ? 'Get it on' : 'Coming soon to'}</Text>
        <Text style={styles.storePillName}>{store}</Text>
      </View>
    </>
  );
  if (url) {
    return (
      <PressableScale
        style={styles.storePill}
        onPress={() => Linking.openURL(url)}
        accessibilityRole="link"
        accessibilityLabel={`Get it on ${store}`}
      >
        {body}
      </PressableScale>
    );
  }
  return (
    <View style={styles.storePill} accessible accessibilityLabel={`Coming soon to ${store}`}>
      {body}
    </View>
  );
}

/** Gently floating, slightly tilted device mockup (desktop hero). Static under reduced motion. */
function FloatingDevice({ reduced, source }: { reduced: boolean; source: number }) {
  const frame = (
    <View style={styles.heroDeviceFrame}>
      <Image
        source={source}
        style={styles.screenshot}
        resizeMode="cover"
        accessibilityLabel="Live cash game screen floating in a phone frame: felt table, players, and the pot"
      />
    </View>
  );
  return (
    <View style={styles.heroDeviceWrap}>
      <View pointerEvents="none" style={styles.heroDeviceGlow} />
      {reduced ? (
        frame
      ) : (
        <MotiView
          from={{ translateY: 0 }}
          animate={{ translateY: -8 }}
          transition={{ type: 'timing', duration: 3000, loop: true, repeatReverse: true }}
        >
          {frame}
        </MotiView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.huge,
    alignItems: 'stretch',
  },
  column: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.huge,
  },

  // ── Top bar ──
  topBar: {
    width: '100%',
    paddingVertical: spacing.sm,
    backgroundColor: 'transparent',
  },
  topBarSolid: {
    backgroundColor: colors.backgroundDeep,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarInner: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  navLink: { ...typography.labelSmall, color: colors.textMuted },
  signIn: { ...typography.label, color: colors.gold },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.huge,
  },
  heroWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.huge,
  },
  heroText: { alignItems: 'center', gap: spacing.lg },
  heroTextWide: { flex: 1, alignItems: 'flex-start', maxWidth: 560 },
  glowGold: {
    position: 'absolute',
    width: 620,
    height: 620,
    borderRadius: 310,
    backgroundColor: colors.goldFaint,
    top: '6%',
    left: '4%',
  },
  glowFelt: {
    position: 'absolute',
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: colors.feltFaint,
    bottom: '4%',
    right: '2%',
  },
  glowCore: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.goldSubtle,
    opacity: 0.35,
    top: '24%',
    left: '18%',
  },
  heroDeviceCol: { alignItems: 'center', justifyContent: 'center' },
  heroDeviceWrap: { alignItems: 'center', justifyContent: 'center' },
  heroDeviceGlow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: colors.goldFaint,
  },
  heroDeviceFrame: {
    width: 280,
    height: Math.round(280 / IMAGE_ASPECT),
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    overflow: 'hidden',
    backgroundColor: colors.backgroundDeep,
    transform: [{ rotate: '4deg' }],
  },
  heroTitle: {
    ...typography.displaySerif,
    fontSize: 52,
    lineHeight: 60,
    color: colors.goldLight,
    textAlign: 'center',
    maxWidth: 760,
  },
  heroTitleWide: { textAlign: 'left' },
  heroSub: {
    ...typography.bodyLarge,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 560,
  },
  heroSubWide: { textAlign: 'left' },
  heroCtas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  heroCtasWide: { justifyContent: 'flex-start' },
  trustLine: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  trustLineWide: { textAlign: 'left' },
  scrollCue: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    opacity: 0.7,
  },

  // ── Feature sections ──
  section: {
    alignItems: 'center',
    gap: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionRowReverse: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  sectionText: {
    gap: spacing.md,
    alignItems: 'center',
    maxWidth: 520,
  },
  sectionTextWide: {
    flex: 1,
    alignItems: 'flex-start',
    maxWidth: 460,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  eyebrowRowCentered: { justifyContent: 'center' },
  eyebrow: {
    ...typography.caps,
    color: colors.gold,
  },
  eyebrowSolo: { marginBottom: spacing.sm },
  eyebrowRule: {
    width: 28,
    height: 2,
    borderRadius: 1,
    marginBottom: spacing.sm,
    transformOrigin: 'left center',
  },
  eyebrowRuleCentered: { alignSelf: 'center' },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.gold,
    zIndex: 50,
    transformOrigin: 'left center',
  },
  sectionHeading: {
    ...typography.displaySerif,
    fontSize: 34,
    lineHeight: 42,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionBody: {
    ...typography.bodyLarge,
    color: colors.textMuted,
    maxWidth: 460,
  },
  sectionMediaWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaGlow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: colors.goldFaint,
    alignSelf: 'center',
  },
  deviceFrame: {
    width: 320,
    height: Math.round(320 / IMAGE_ASPECT),
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.backgroundDeep,
  },
  screenshot: { width: '100%', height: '100%' },

  // ── Premium + pricing ──
  premiumBlock: { gap: spacing.xl },
  lead: { ...typography.h4, color: colors.goldLight, marginTop: spacing.sm },
  studyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  studyItem: {
    flexGrow: 1,
    flexBasis: 240,
    gap: spacing.xs,
  },
  studyIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  studyTitle: { ...typography.h4, color: colors.text },
  studyBody: { ...typography.bodySmall, color: colors.textMuted },
  plans: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  planCard: {
    flexGrow: 1,
    flexBasis: 300,
    gap: spacing.sm,
  },
  bestValueChip: { alignSelf: 'flex-start' },
  price: { ...typography.amountLarge, color: colors.text },
  cadence: { ...typography.bodySmall, color: colors.textMuted },
  subline: { ...typography.bodySmall, color: colors.goldLight },
  premiumNote: {
    ...typography.label,
    color: colors.gold,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  benefitList: { gap: spacing.sm, paddingVertical: spacing.sm },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefitLive: { ...typography.body, color: colors.textHigh, flex: 1 },
  benefitSoon: { ...typography.body, color: colors.textMuted, flex: 1 },

  // ── FAQ ──
  faqBlock: { gap: spacing.md },

  // ── Footer ──
  footer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  storeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  storePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  storePillHint: { ...typography.caption, color: colors.textMuted },
  storePillName: { ...typography.label, color: colors.textHigh },
  legalRow: { flexDirection: 'row', gap: spacing.lg },
  legalLink: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  disclaimer: { ...typography.caption, color: colors.textDim },
  byline: {
    ...typography.caps,
    fontSize: 10,
    color: colors.goldMuted,
    letterSpacing: 1.5,
  },
});
