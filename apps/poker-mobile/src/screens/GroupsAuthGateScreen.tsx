import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { iconSize } from '../theme/iconSize';
import { RootStackParamList } from '../navigation/AppNavigator';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import { MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PERKS: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
  { icon: 'albums-outline', label: 'Shared sessions & full game history' },
  { icon: 'trophy-outline', label: 'Group leaderboards & rivalries' },
  { icon: 'pulse-outline', label: 'A live activity feed for your crew' },
];

/** Groups tab for guests: premium gate explaining what an account unlocks. */
export default function GroupsAuthGateScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  return (
    <Screen style={{ paddingTop: insets.top }}>
      <Text style={styles.title}>Groups</Text>

      <View style={styles.body}>
        <MotiView {...slideUpSequence({ reduced })} style={styles.iconCircle}>
          <Ionicons name="people" size={iconSize.lg} color={colors.gold} />
        </MotiView>

        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(1) })}>
          <Text style={styles.headline}>Your club awaits</Text>
          <Text style={styles.subtitle}>
            Groups are where your poker crew lives. Sign in to create or join one.
          </Text>
        </MotiView>

        <View style={styles.perks}>
          {PERKS.map((perk, i) => (
            <MotiView
              key={perk.label}
              {...slideUpSequence({ reduced, delay: staggerIn(i + 2) })}
              style={styles.perkRow}
            >
              <View style={styles.perkIcon}>
                <Ionicons name={perk.icon} size={iconSize.sm} color={colors.gold} />
              </View>
              <Text style={styles.perkLabel}>{perk.label}</Text>
            </MotiView>
          ))}
        </View>

        <MotiView
          {...slideUpSequence({ reduced, delay: staggerIn(PERKS.length + 2) })}
          style={styles.ctaWrap}
        >
          <PrimaryButton
            label="Sign In"
            variant="gradient"
            onPress={() => navigation.navigate('Login')}
            accessibilityLabel="Sign in to create or join a group"
          />
        </MotiView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.displaySerif,
    color: colors.text,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: radii.xl,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  perks: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  perkIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  perkLabel: {
    ...typography.bodySmall,
    color: colors.textHigh,
    flex: 1,
  },
  ctaWrap: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
});
