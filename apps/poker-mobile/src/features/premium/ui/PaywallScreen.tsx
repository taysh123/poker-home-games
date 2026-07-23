import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import Chip from '../../../components/Chip';
import PrimaryButton from '../../../components/PrimaryButton';
import PressableScale from '../../../components/motion/PressableScale';
import { MotiView, slideUpSequence, staggerIn, successPop } from '../../../components/motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { iconSize } from '../../../theme/iconSize';
import { showToast } from '../../../utils/toast';
import { track } from '../../../utils/analytics';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { usePremium } from '../state/PremiumContext';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { PRICING, PREMIUM_FEATURES, isFeatureLive, paywallPriceFor } from '../config';
import { isFeatureEnabled } from '../../../config/features';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'Paywall'>;

export default function PaywallScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { isPremium, purchasing, purchase, restore, products } = usePremium();
  const { refresh: refreshEntitlement } = useEntitlements();
  const reduced = useReducedMotion();
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [restoring, setRestoring] = useState(false);
  // Honest pending state: checkout overlay is open / user was redirected — premium not yet granted.
  const [pendingVerification, setPendingVerification] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Provider-supplied (SDK/store-localized) price when available; config string is the honest fallback.
  const priceForPlan = (p: 'yearly' | 'monthly') =>
    paywallPriceFor(p, products.find(pr => pr.id === PRICING[p].productId)?.price);

  useEffect(() => {
    track('paywall_viewed', { trigger: route.params?.trigger ?? 'unknown' });
  }, [route.params?.trigger]);

  function selectPlan(p: 'yearly' | 'monthly') {
    setPlan(p);
    track('paywall_plan_selected', { plan: p });
  }

  const productId = plan === 'yearly' ? PRICING.yearly.productId : PRICING.monthly.productId;

  async function upgrade() {
    track('purchase_started', { plan });
    const res = await purchase(productId);
    if (res.ok) {
      // Server is authority — refresh the entitlement so the whole app re-reads server truth.
      await refreshEntitlement();
      track('purchase_completed', { plan });
      showToast('Welcome to T Poker Premium ✦', 'success');
      navigation.goBack();
    } else if (res.error === 'pending_verification') {
      // Paddle overlay is open (or user was redirected to checkout). Premium is NOT granted yet —
      // the entitlement updates only after the server processes the Paddle webhook. Show an honest
      // "completing" state; the user taps "Check status" once they finish in the checkout window.
      setPendingVerification(true);
      track('purchase_pending', { plan });
    } else {
      track('purchase_failed', { plan, reason: res.error ?? 'unknown' });
      showToast('Purchase could not be completed.', 'error');
    }
  }

  /** After the user completes payment in the Paddle overlay, re-check the server for the entitlement. */
  async function checkVerificationStatus() {
    setCheckingStatus(true);
    try {
      // restore() is server-authoritative — it reads GET /api/entitlements and returns ok:true only
      // if the server has granted premium (via the Paddle webhook). Never claims premium without
      // server confirmation.
      const res = await restore();
      if (res.ok) {
        await refreshEntitlement();
        track('purchase_completed', { plan, via: 'pending_verify' });
        showToast('Welcome to T Poker Premium ✦', 'success');
        navigation.goBack();
      } else {
        showToast('Payment not yet confirmed — check back in a moment.', 'info');
      }
    } finally {
      setCheckingStatus(false);
    }
  }

  async function onRestore() {
    setRestoring(true);
    track('restore_started');
    try {
      const res = await restore();
      if (res.ok) await refreshEntitlement();
      track('restore_result', { ok: res.ok });
      showToast(res.ok ? 'Premium restored.' : 'No purchase to restore.', res.ok ? 'success' : 'info');
    } finally {
      setRestoring(false);
    }
  }

  const paywallOn = isFeatureEnabled('paywall');

  // HONESTY GATE: when the paywall flag is OFF, render informational preview only — no purchase UI.
  if (!paywallOn) {
    return (
      <Screen>
        <BrandHeader variant="screen" title="T Poker Premium" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <MotiView {...slideUpSequence({ reduced })}>
            <Card variant="hero">
              <Text style={styles.heroTitle}>Go deeper. Play → Track → Study → Improve.</Text>
              <Text style={styles.heroSub}>Premium isn't available yet — it's coming soon.</Text>
            </Card>
          </MotiView>
          <View style={styles.features}>
            {PREMIUM_FEATURES.map((f, i) => (
              <MotiView
                key={f.key}
                {...slideUpSequence({ reduced, delay: staggerIn(i) })}
                style={styles.featureRow}
                accessible
                accessibilityRole="text"
                accessibilityLabel={`${f.title}, coming soon`}
              >
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon as React.ComponentProps<typeof Ionicons>['name']} size={iconSize.xs} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.featureTitleRow}>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Chip label="Soon" tone="neutral" />
                  </View>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </MotiView>
            ))}
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <BrandHeader variant="screen" title="T Poker Premium" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isPremium ? (
          <Card variant="hero" style={styles.activeCard}>
            <MotiView {...successPop({ reduced })}>
              <Ionicons name="checkmark-circle" size={iconSize.lg} color={colors.gold} />
            </MotiView>
            <Text style={styles.activeTitle}>You're Premium</Text>
            <Text style={styles.activeSub}>All premium features are unlocked. Thanks for the support.</Text>
          </Card>
        ) : (
          <>
            <Card variant="hero">
              <Text style={styles.heroTitle}>Go deeper. Play → Track → Study → Improve.</Text>
              <Text style={styles.heroSub}>Here's what Premium unlocks as features roll out.</Text>
            </Card>

            {/* Feature list: live benefits lead with gold styling; Soon features are muted with a chip.
                isFeatureLive() is the single gating source — a Soon feature can never reach the CTA. */}
            <View style={styles.features}>
              {PREMIUM_FEATURES.map((f, i) => {
                const live = isFeatureLive(f.key);
                return (
                  <MotiView
                    key={f.key}
                    {...slideUpSequence({ reduced, delay: staggerIn(i) })}
                    style={styles.featureRow}
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={`${f.title}, ${live ? 'included with Premium' : 'coming soon'}`}
                  >
                    <View style={[styles.featureIcon, !live && styles.featureIconSoon]}>
                      <Ionicons
                        name={f.icon as React.ComponentProps<typeof Ionicons>['name']}
                        size={iconSize.xs}
                        color={live ? colors.gold : colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.featureTitleRow}>
                        <Text style={[styles.featureTitle, !live && styles.featureTitleSoon]}>
                          {f.title}
                        </Text>
                        {!live && <Chip label="Soon" tone="neutral" />}
                      </View>
                      <Text style={styles.featureDesc}>{f.desc}</Text>
                    </View>
                  </MotiView>
                );
              })}
            </View>

            {pendingVerification ? (
              /* Honest "completing" state — checkout overlay is open or the user was redirected.
                 Premium is NOT claimed until restore() confirms it via the server entitlement. */
              <Card style={styles.pendingCard}>
                <Ionicons name="time-outline" size={28} color={colors.gold} />
                <Text style={styles.pendingTitle}>Complete your checkout</Text>
                <Text style={styles.pendingBody}>
                  Finish payment in the checkout window. Once done, tap below — we'll check
                  your subscription status with our server. If you were redirected, you'll return
                  here automatically once payment is confirmed.
                </Text>
                <PrimaryButton
                  label={checkingStatus ? 'Checking…' : "I've completed payment — activate"}
                  variant="gradient"
                  loading={checkingStatus}
                  onPress={checkVerificationStatus}
                  accessibilityLabel="Check subscription status after completing checkout"
                />
                <PressableScale
                  onPress={() => setPendingVerification(false)}
                  style={styles.restore}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to plan selection"
                >
                  <Text style={styles.restoreText}>{'← Back to plans'}</Text>
                </PressableScale>
              </Card>
            ) : (
              <>
                {/* Plan toggle — yearly default with "save X%" badge; non-color affordance: checkmark */}
                <View style={styles.plans}>
                  <PlanCard
                    selected={plan === 'yearly'}
                    onPress={() => selectPlan('yearly')}
                    title="Annual"
                    price={priceForPlan('yearly')}
                    sub={`${PRICING.yearly.perMonth}/mo · save ${PRICING.yearly.savePct}%`}
                    badge="Best value"
                  />
                  <PlanCard
                    selected={plan === 'monthly'}
                    onPress={() => selectPlan('monthly')}
                    title="Monthly"
                    price={priceForPlan('monthly')}
                    sub="billed monthly"
                  />
                </View>

                <PrimaryButton
                  label={
                    plan === 'yearly'
                      ? `Go Premium — ${priceForPlan('yearly')}/yr`
                      : `Go Premium — ${priceForPlan('monthly')}/mo`
                  }
                  variant="gradient"
                  loading={purchasing}
                  onPress={upgrade}
                  accessibilityLabel={
                    plan === 'yearly'
                      ? `Subscribe to annual plan for ${priceForPlan('yearly')} per year`
                      : `Subscribe to monthly plan for ${priceForPlan('monthly')} per month`
                  }
                />
                <PressableScale
                  onPress={onRestore}
                  disabled={restoring}
                  style={styles.restore}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Restore purchases"
                >
                  <Text style={styles.restoreText}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text>
                </PressableScale>
              </>
            )}

            <Text style={styles.fine}>
              Subscriptions renew until cancelled. Cancel anytime in your store account. AI analyses
              are subject to a fair-use monthly quota.
            </Text>
            <View style={styles.legalRow}>
              <PressableScale
                onPress={() => Linking.openURL('https://app.tpoker.app/terms.html')}
                hitSlop={12} accessibilityRole="link" accessibilityLabel="Terms of Service"
              >
                <Text style={styles.helpText}>Terms</Text>
              </PressableScale>
              <Text style={styles.legalDot}>·</Text>
              <PressableScale
                onPress={() => Linking.openURL('https://app.tpoker.app/privacy.html')}
                hitSlop={12} accessibilityRole="link" accessibilityLabel="Privacy Policy"
              >
                <Text style={styles.helpText}>Privacy Policy</Text>
              </PressableScale>
              <Text style={styles.legalDot}>·</Text>
              <PressableScale
                onPress={() => Linking.openURL('mailto:truestorylabs@gmail.com?subject=Purchase%20help')}
                hitSlop={12} accessibilityRole="button" accessibilityLabel="Get help with a purchase"
              >
                <Text style={styles.helpText}>Need help?</Text>
              </PressableScale>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function PlanCard({
  selected, onPress, title, price, sub, badge,
}: {
  selected: boolean; onPress: () => void; title: string; price: string; sub: string; badge?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      style={{ flex: 1 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title} plan, ${price}${badge ? ', ' + badge : ''}`}
    >
      <Card style={[styles.planCard, selected && styles.planCardActive]}>
        {badge ? (
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>{badge}</Text>
          </View>
        ) : null}
        {/* Non-color affordance for the active state: checkmark icon supplements the gold border */}
        {selected && (
          <MotiView style={styles.planCheck} {...successPop({ reduced })}>
            <Ionicons name="checkmark-circle" size={iconSize.xs} color={colors.gold} />
          </MotiView>
        )}
        <Text style={styles.planTitle}>{title}</Text>
        <Text style={styles.planPrice}>{price}</Text>
        <Text style={styles.planSub}>{sub}</Text>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 60, gap: spacing.lg },
  heroTitle: { ...typography.h2, color: colors.text },
  heroSub: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  features: { gap: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // Live feature: gold tint icon background; Soon feature: elevated surface, no gold
  featureIcon: { width: 38, height: 38, borderRadius: radii.sm, backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center' },
  featureIconSoon: { backgroundColor: colors.surfaceHigh },
  featureTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureTitle: { ...typography.label, color: colors.text },
  featureTitleSoon: { color: colors.textMuted },
  featureDesc: { ...typography.bodySmall, color: colors.textMuted },
  plans: { flexDirection: 'row', gap: spacing.sm },
  planCard: { alignItems: 'center', paddingVertical: spacing.lg, gap: 2 },
  // Active plan: gold border + checkmark (non-color affordance — never color-only)
  planCardActive: { borderColor: colors.gold },
  planCheck: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  planBadge: { position: 'absolute', top: -8, backgroundColor: colors.gold, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  planBadgeText: { ...typography.caps, color: colors.background, fontSize: 9 },
  planTitle: { ...typography.label, color: colors.textMuted },
  planPrice: { ...typography.h2, color: colors.text },
  planSub: { ...typography.bodySmall, color: colors.textMuted },
  // Pending verification card
  pendingCard: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  pendingTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  pendingBody: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  restore: { alignItems: 'center', paddingVertical: spacing.sm },
  restoreText: { ...typography.label, color: colors.gold },
  legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  legalDot: { ...typography.bodySmall, color: colors.textDim },
  helpText: { ...typography.bodySmall, color: colors.textMuted, textDecorationLine: 'underline' },
  fine: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },
  activeCard: { alignItems: 'center', gap: spacing.xs },
  activeTitle: { ...typography.h2, color: colors.text },
  activeSub: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
