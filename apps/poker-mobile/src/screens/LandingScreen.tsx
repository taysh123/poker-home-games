import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Chip from '../components/Chip';
import SectionTitle from '../components/SectionTitle';
import PrimaryButton from '../components/PrimaryButton';
import BrandHeader from '../components/BrandHeader';
import PressableScale from '../components/motion/PressableScale';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { usePremium } from '../features/premium/state/PremiumContext';
import { useAuth } from '../context/AuthContext';
import { PRICING } from '../features/premium/config';
import { savePendingCheckout, type CheckoutPlan } from '../utils/pendingCheckout';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  LANDING_HERO,
  LANDING_CLUB_VALUE,
  LANDING_STUDY_VALUE,
  PREMIUM_STUDY_BENEFIT,
  landingPlans,
  landingBenefits,
  LANDING_FAQ,
  LANDING_LEGAL_LINKS,
  LANDING_DISCLAIMER,
} from '../features/landing/landingContent';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Web-only landing/pricing page (renders null on native).
 * Two-sided hook-forward: free club tool + Premium Study upsell.
 * - Logged-out CTA: stash pending checkout → Register → resume on Paywall.
 * - Logged-in CTA: call purchase() directly via PremiumContext.
 * - Honesty gate: "Soon" benefits show a chip, never a buy affordance.
 */
export default function LandingScreen() {
  if (Platform.OS !== 'web') return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const navigation = useNavigation<Nav>();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isPremium, purchasing, purchase } = usePremium();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user } = useAuth();

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

  const plans = landingPlans();
  const benefits = landingBenefits();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxWidth}>
          {/* ── Top bar ── */}
          <BrandHeader
            variant="brand"
            right={
              <PressableScale
                onPress={() => navigation.navigate('Login')}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
              >
                <Text style={styles.signIn}>Sign in</Text>
              </PressableScale>
            }
          />

          {/* ── 1. Hero ── */}
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{LANDING_HERO.headline}</Text>
            <Text style={styles.heroSub}>{LANDING_HERO.subhead}</Text>
            <View style={styles.heroCtas}>
              <PrimaryButton
                variant="gradient"
                label={LANDING_HERO.primaryCta}
                onPress={() => navigation.navigate('LocalNewGame', { mode: 'cash' })}
                fullWidth={false}
              />
              <PrimaryButton
                variant="outline"
                label={LANDING_HERO.secondaryCta}
                onPress={() => {/* scroll-to-pricing; focusable anchor */}}
                fullWidth={false}
              />
            </View>
          </View>

          {/* ── 2. Free club tool ── */}
          <SectionTitle>FREE CLUB TOOL</SectionTitle>
          {LANDING_CLUB_VALUE.map(v => (
            <ValueCard key={v.title} icon={v.icon} title={v.title} body={v.body} />
          ))}

          {/* ── 3. Between sessions — Premium Study ── */}
          <SectionTitle>BETWEEN SESSIONS</SectionTitle>
          <Text style={styles.lead}>{PREMIUM_STUDY_BENEFIT}</Text>
          {LANDING_STUDY_VALUE.map(v => (
            <ValueCard key={v.title} icon={v.icon} title={v.title} body={v.body} />
          ))}

          {/* ── 4. Pricing ── */}
          <SectionTitle>PRICING</SectionTitle>
          <View style={styles.plans}>
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
                {p.subline ? (
                  <Text style={styles.subline}>{p.subline}</Text>
                ) : null}
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
          </View>

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
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.gold}
                    />
                    <Text style={styles.benefitLive}>{b.title}</Text>
                  </>
                )}
              </View>
            ))}
          </View>

          {/* ── 5. FAQ ── */}
          <SectionTitle>FAQ</SectionTitle>
          {LANDING_FAQ.map(f => (
            <View
              key={f.q}
              style={styles.faq}
              accessible
              accessibilityLabel={`${f.q}. ${f.a}`}
            >
              <Text style={styles.faqQ}>{f.q}</Text>
              <Text style={styles.faqA}>{f.a}</Text>
            </View>
          ))}

          {/* ── 6. Footer ── */}
          <View style={styles.footer}>
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
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function ValueCard({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}) {
  return (
    <Card variant="flat" style={styles.valueCard}>
      <View style={styles.valueIcon}>
        <Ionicons name={icon} size={20} color={colors.gold} />
      </View>
      <View style={styles.valueText}>
        <Text style={styles.valueTitle}>{title}</Text>
        <Text style={styles.valueBody}>{body}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
    alignItems: 'center',
  },
  maxWidth: {
    width: '100%',
    maxWidth: 920,
    gap: spacing.lg,
  },
  // Top bar
  signIn: {
    ...typography.label,
    color: colors.gold,
  },
  // Hero
  hero: {
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  heroTitle: {
    ...typography.hero,
    color: colors.text,
  },
  heroSub: {
    ...typography.bodyLarge,
    color: colors.textMuted,
    maxWidth: 640,
  },
  heroCtas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  // Value cards
  lead: {
    ...typography.h4,
    color: colors.goldLight,
  },
  valueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  valueIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  valueText: { flex: 1 },
  valueTitle: {
    ...typography.h4,
    color: colors.text,
  },
  valueBody: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  // Pricing
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
  bestValueChip: {
    alignSelf: 'flex-start',
  },
  price: {
    ...typography.amountLarge,
    color: colors.text,
  },
  cadence: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  subline: {
    ...typography.bodySmall,
    color: colors.goldLight,
  },
  premiumNote: {
    ...typography.label,
    color: colors.gold,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  // Shared benefit list
  benefitList: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitLive: {
    ...typography.body,
    color: colors.textHigh,
    flex: 1,
  },
  benefitSoon: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
  },
  // FAQ
  faq: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  faqQ: {
    ...typography.h4,
    color: colors.text,
  },
  faqA: {
    ...typography.body,
    color: colors.textMuted,
  },
  // Footer
  footer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  legalRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  legalLink: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textDim,
  },
});
