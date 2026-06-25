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
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { showToast } from '../../../utils/toast';
import { track } from '../../../utils/analytics';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { usePremium } from '../state/PremiumContext';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { PRICING, PREMIUM_FEATURES } from '../config';
import { isFeatureEnabled } from '../../../config/features';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'Paywall'>;

export default function PaywallScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { isPremium, purchasing, purchase, restore, products } = usePremium();
  const { refresh: refreshEntitlement } = useEntitlements();
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [restoring, setRestoring] = useState(false);

  // Provider-supplied (store-localized) price when available; config string is the fallback only.
  const priceFor = (p: 'yearly' | 'monthly') =>
    products.find(pr => pr.id === PRICING[p].productId)?.price ?? PRICING[p].price;

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
    } else {
      track('purchase_failed', { plan, reason: res.error ?? 'unknown' });
      showToast('Purchase could not be completed.', 'error');
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
          <Card variant="hero">
            <Text style={styles.heroTitle}>Go deeper. Play → Track → Study → Improve.</Text>
            <Text style={styles.heroSub}>Premium isn't available yet — it's coming soon.</Text>
          </Card>
          <View style={styles.features}>
            {PREMIUM_FEATURES.map(f => (
              <View key={f.key} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon as React.ComponentProps<typeof Ionicons>['name']} size={18} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.featureTitleRow}>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Chip label="Soon" tone="neutral" />
                  </View>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
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
            <Ionicons name="checkmark-circle" size={30} color={colors.gold} />
            <Text style={styles.activeTitle}>You're Premium</Text>
            <Text style={styles.activeSub}>All premium features are unlocked. Thanks for the support.</Text>
          </Card>
        ) : (
          <>
            <Card variant="hero">
              <Text style={styles.heroTitle}>Go deeper. Play → Track → Study → Improve.</Text>
              <Text style={styles.heroSub}>Here's what Premium unlocks as features roll out.</Text>
            </Card>

            <View style={styles.features}>
              {PREMIUM_FEATURES.map(f => (
                <View key={f.key} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={f.icon as React.ComponentProps<typeof Ionicons>['name']} size={18} color={colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.featureTitleRow}>
                      <Text style={styles.featureTitle}>{f.title}</Text>
                      {f.comingSoon && <Chip label="Soon" tone="neutral" />}
                    </View>
                    <Text style={styles.featureDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Plan toggle */}
            <View style={styles.plans}>
              <PlanCard
                selected={plan === 'yearly'} onPress={() => selectPlan('yearly')}
                title="Annual" price={priceFor('yearly')} sub={`${PRICING.yearly.perMonth}/mo · save ${PRICING.yearly.savePct}%`}
                badge="Best value"
              />
              <PlanCard
                selected={plan === 'monthly'} onPress={() => selectPlan('monthly')}
                title="Monthly" price={priceFor('monthly')} sub="billed monthly"
              />
            </View>

            <PrimaryButton
              label={plan === 'yearly' ? `Go Premium — ${priceFor('yearly')}/yr` : `Go Premium — ${priceFor('monthly')}/mo`}
              variant="gradient" loading={purchasing} onPress={upgrade}
            />
            <PressableScale onPress={onRestore} disabled={restoring} style={styles.restore} hitSlop={12} accessibilityRole="button" accessibilityLabel="Restore purchases">
              <Text style={styles.restoreText}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text>
            </PressableScale>
            <Text style={styles.fine}>
              Subscriptions renew until cancelled. Cancel anytime in your store account. AI analyses
              are subject to a fair-use monthly quota.
            </Text>
            <View style={styles.legalRow}>
              <PressableScale
                onPress={() => Linking.openURL('https://poker-home-games-three.vercel.app/terms.html')}
                hitSlop={12} accessibilityRole="link" accessibilityLabel="Terms of Service"
              >
                <Text style={styles.helpText}>Terms</Text>
              </PressableScale>
              <Text style={styles.legalDot}>·</Text>
              <PressableScale
                onPress={() => Linking.openURL('https://poker-home-games-three.vercel.app/privacy.html')}
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

function PlanCard({ selected, onPress, title, price, sub, badge }: {
  selected: boolean; onPress: () => void; title: string; price: string; sub: string; badge?: string;
}) {
  return (
    <PressableScale onPress={onPress} haptic="light" style={{ flex: 1 }}>
      <Card style={[styles.planCard, selected && styles.planCardActive]}>
        {badge ? <View style={styles.planBadge}><Text style={styles.planBadgeText}>{badge}</Text></View> : null}
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
  featureIcon: { width: 38, height: 38, borderRadius: radii.sm, backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center' },
  featureTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureTitle: { ...typography.label, color: colors.text },
  featureDesc: { ...typography.bodySmall, color: colors.textMuted },
  plans: { flexDirection: 'row', gap: spacing.sm },
  planCard: { alignItems: 'center', paddingVertical: spacing.lg, gap: 2 },
  planCardActive: { borderColor: colors.gold },
  planBadge: { position: 'absolute', top: -8, backgroundColor: colors.gold, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  planBadgeText: { ...typography.caps, color: colors.background, fontSize: 9 },
  planTitle: { ...typography.label, color: colors.textMuted },
  planPrice: { ...typography.h2, color: colors.text },
  planSub: { ...typography.bodySmall, color: colors.textMuted },
  restore: { alignItems: 'center', paddingVertical: spacing.sm },
  restoreText: { ...typography.label, color: colors.gold },
  legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  legalDot: { ...typography.bodySmall, color: colors.textDim },
  helpText: { ...typography.bodySmall, color: colors.textMuted, textDecorationLine: 'underline' },
  fine: { ...typography.bodySmall, color: colors.textDim, textAlign: 'center' },
  activeCard: { alignItems: 'center', gap: spacing.xs },
  activeTitle: { ...typography.h2, color: colors.text },
  activeSub: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
