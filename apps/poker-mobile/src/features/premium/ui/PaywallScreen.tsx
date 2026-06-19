import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../../components/Screen';
import BrandHeader from '../../../components/BrandHeader';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import PressableScale from '../../../components/motion/PressableScale';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { showToast } from '../../../utils/toast';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { usePremium } from '../state/PremiumContext';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { PRICING, PREMIUM_FEATURES } from '../config';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PaywallScreen() {
  const navigation = useNavigation<Nav>();
  const { isPremium, purchasing, purchase, restore } = usePremium();
  const { refresh: refreshEntitlement } = useEntitlements();
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');

  const productId = plan === 'yearly' ? PRICING.yearly.productId : PRICING.monthly.productId;

  async function upgrade() {
    const res = await purchase(productId);
    if (res.ok) {
      // Server is authority — refresh the entitlement so the whole app re-reads server truth.
      await refreshEntitlement();
      showToast('Welcome to T Poker Premium ✦', 'success');
      navigation.goBack();
    } else {
      showToast('Purchase could not be completed.', 'error');
    }
  }
  async function onRestore() {
    const res = await restore();
    if (res.ok) await refreshEntitlement();
    showToast(res.ok ? 'Premium restored.' : 'No purchase to restore.', res.ok ? 'success' : 'info');
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
              <Text style={styles.heroSub}>Unlock AI coaching, advanced GTO, deeper analytics and cloud sync.</Text>
            </Card>

            <View style={styles.features}>
              {PREMIUM_FEATURES.map(f => (
                <View key={f.key} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={f.icon as React.ComponentProps<typeof Ionicons>['name']} size={18} color={colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.featureDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Plan toggle */}
            <View style={styles.plans}>
              <PlanCard
                selected={plan === 'yearly'} onPress={() => setPlan('yearly')}
                title="Annual" price={PRICING.yearly.price} sub={`${PRICING.yearly.perMonth}/mo · save ${PRICING.yearly.savePct}%`}
                badge="Best value"
              />
              <PlanCard
                selected={plan === 'monthly'} onPress={() => setPlan('monthly')}
                title="Monthly" price={PRICING.monthly.price} sub="billed monthly"
              />
            </View>

            <PrimaryButton
              label={plan === 'yearly' ? `Go Premium — ${PRICING.yearly.price}/yr` : `Go Premium — ${PRICING.monthly.price}/mo`}
              variant="gradient" loading={purchasing} onPress={upgrade}
            />
            <PressableScale onPress={onRestore} style={styles.restore}>
              <Text style={styles.restoreText}>Restore purchases</Text>
            </PressableScale>
            <Text style={styles.fine}>
              Subscriptions renew until cancelled. Cancel anytime in your store account. AI analyses
              are subject to a fair-use monthly quota.
            </Text>
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
  fine: { ...typography.bodySmall, color: colors.textDim, textAlign: 'center' },
  activeCard: { alignItems: 'center', gap: spacing.xs },
  activeTitle: { ...typography.h2, color: colors.text },
  activeSub: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
