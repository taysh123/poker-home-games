import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { Sora } from '../theme/fonts';
import PressableScale from './motion/PressableScale';

type Props = {
  /** 'brand' = prominent logo + wordmark (top-level/tab screens); 'screen' = compact logo + title (deep screens). */
  variant?: 'brand' | 'screen';
  title?: string;
  subtitle?: string;
  /** Renders a back button (deep screens). */
  onBack?: () => void;
  /** Right-side slot (icon buttons, avatar, badges). */
  right?: React.ReactNode;
};

/**
 * Unified brand header. The T Poker logo lockup is a persistent home anchor —
 * tapping it always returns to Home (MainTabs). Owns its safe-area top inset.
 * Replaces the ad-hoc Home header + ScreenHeader so chrome is consistent.
 */
export default function BrandHeader({ variant = 'screen', title, subtitle, onBack, right }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const goHome = () => {
    // Pop back to the tab navigator; Home is its first tab.
    navigation.navigate('MainTabs');
  };

  const isBrand = variant === 'brand';

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={8} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : null}

        {/* Logo home anchor */}
        <PressableScale style={styles.logoBtn} onPress={goHome} haptic="light" accessibilityLabel="Home">
          <View style={[styles.logoRing, isBrand && styles.logoRingBrand]}>
            <Image source={require('../../assets/logo.png')} style={isBrand ? styles.logoBrand : styles.logo} resizeMode="contain" />
          </View>
          {isBrand ? <Text style={styles.wordmark}>T POKER</Text> : null}
        </PressableScale>

        {/* Title block (deep screens, or a labelled tab screen) */}
        {title ? (
          <View style={styles.titles}>
            <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.3}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        ) : (
          <View style={styles.spacer} />
        )}

        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoRing: {
    width: 34,
    height: 34,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoRingBrand: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderColor: colors.goldMuted,
    backgroundColor: colors.goldFaint,
  },
  logo: { width: 34, height: 34, borderRadius: 10 },
  logoBrand: { width: 40, height: 40, borderRadius: 12 },
  wordmark: {
    fontFamily: Sora['700'],
    fontSize: 17,
    color: colors.text,
    letterSpacing: 2,
  },
  titles: { flex: 1, gap: 2 },
  title: { ...typography.h3, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textMuted },
  spacer: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
