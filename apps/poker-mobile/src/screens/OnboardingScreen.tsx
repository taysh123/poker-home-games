import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import Screen from '../components/Screen';
import * as storage from '../utils/storage';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'layers' as const,
    title: 'Track Every Game',
    subtitle: 'Buy-ins, cash-outs, and settlements recorded in real time. No spreadsheets, no arguments.',
  },
  {
    icon: 'people' as const,
    title: 'Play With Your Crew',
    subtitle: 'Create private groups, invite friends, and track your home game across every session.',
  },
  {
    icon: 'bar-chart' as const,
    title: 'Know Your Numbers',
    subtitle: 'Lifetime P&L, win rate, head-to-head stats, and session recaps — all in one place.',
  },
];

function Dot({ active }: { active: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withSpring(active ? 24 : 8, { damping: 18, stiffness: 220 }),
    opacity: withTiming(active ? 1 : 0.7, { duration: 200 }),
  }));
  return <Animated.View style={[styles.dot, active && styles.dotActive, style]} />;
}

export default function OnboardingScreen({ navigation }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  async function markSeenAndNavigate() {
    await storage.setItemAsync('hasSeenOnboarding', 'true');
    // Land in the guest app — no account required. Sign-in is offered contextually.
    navigation.replace('MainTabs');
  }

  function goNext() {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setCurrentIndex(next);
    } else {
      markSeenAndNavigate();
    }
  }

  return (
    <Screen style={styles.container}>
      {/* Brand mark */}
      <View style={styles.brandRow}>
        <View style={styles.brandLogoRing}>
          <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
        </View>
        <Text style={styles.brandName}>T POKER</Text>
      </View>

      {/* Skip button */}
      {currentIndex < SLIDES.length - 1 && (
        <TouchableOpacity style={styles.skipBtn} onPress={markSeenAndNavigate} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          if (index !== currentIndex && index >= 0 && index < SLIDES.length) setCurrentIndex(index);
        }}
        style={styles.slideScroll}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={styles.slide}>
            <View style={styles.iconWrap}>
              <Ionicons name={slide.icon} size={40} color={colors.gold} />
            </View>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots + CTA */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Dot key={i} active={i === currentIndex} />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>
            {currentIndex < SLIDES.length - 1 ? 'Next' : 'Get Started'}
          </Text>
          {currentIndex < SLIDES.length - 1 && (
            <Ionicons name="arrow-forward" size={16} color={colors.background} />
          )}
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
  },
  brandRow: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  brandLogoRing: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandLogo: { width: 52, height: 52 },
  brandName: { ...typography.displaySerif, fontSize: 20, color: colors.goldLight, letterSpacing: 4 },

  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: '600',
  },
  slideScroll: { flex: 1 },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  slideTitle: {
    ...typography.displaySerif,
    color: colors.text,
    textAlign: 'center',
  },
  slideSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 24,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceHigh,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.gold,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.background,
  },
});
