import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import BrandHeader from '../components/BrandHeader';
import Card from '../components/Card';
import { PressableScale, MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { useCurrency } from '../context/CurrencyContext';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { formatCents } from '../utils/money';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Preferred currency picker (V2.1 STEP 3.5) — display only, no conversion. Behind `currencyPrefs`. */
export default function CurrencyPickerScreen() {
  const navigation = useNavigation<Nav>();
  const { code, setCurrency } = useCurrency();
  const reduced = useReducedMotion();

  return (
    <Screen>
      <BrandHeader variant="screen" title="Currency" subtitle="Display only — amounts aren't converted" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {SUPPORTED_CURRENCIES.map((c, i) => {
          const active = c.code === code;
          return (
            <MotiView key={c.code} {...slideUpSequence({ reduced, delay: staggerIn(i) })}>
              <PressableScale
                onPress={() => { setCurrency(c.code); navigation.goBack(); }}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={`${c.label} (${c.code})`}
                accessibilityState={{ selected: active }}
              >
                <Card style={[styles.row, active && styles.rowActive]}>
                  <View style={styles.symbolWrap}><Text style={styles.symbol}>{c.symbol}</Text></View>
                  <View style={styles.text}>
                    <Text style={styles.label}>{c.label}</Text>
                    <Text style={styles.sample}>{c.code} · {formatCents(123450, c.code)}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={22} color={colors.gold} />}
                </Card>
              </PressableScale>
            </MotiView>
          );
        })}
        <Text style={styles.note}>
          Changing your currency only changes how amounts are displayed — no exchange rates are applied.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 60, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowActive: { borderColor: colors.gold },
  symbolWrap: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center' },
  symbol: { ...typography.label, color: colors.gold },
  text: { flex: 1, gap: 2 },
  label: { ...typography.label, color: colors.text },
  sample: { ...typography.bodySmall, color: colors.textMuted },
  note: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
