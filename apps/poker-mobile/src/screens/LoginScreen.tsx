import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { guestContinueTarget } from '../navigation/entryRouting';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { useAuth } from '../context/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import GoogleAuthButton from '../components/GoogleAuthButton';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import AppTextInput from '../components/AppTextInput';
import PressableScale from '../components/motion/PressableScale';
import { MotiView, slideUpSequence } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as storage from '../utils/storage';
import { parseAuthError } from '../utils/parseAuthError';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login, googleLogin } = useAuth();
  const reduced = useReducedMotion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Guest escape hatch target. Defaults to "seen" (MainTabs) — the safe arm for
  // returning users if the tap lands before the storage read resolves.
  const [seenOnboarding, setSeenOnboarding] = useState(true);

  useEffect(() => {
    let mounted = true;
    // Read-only — this screen must never WRITE storage (guest-data preservation).
    storage.getItemAsync('hasSeenOnboarding')
      .then(v => { if (mounted) setSeenOnboarding(v === 'true'); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const { prompt: promptGoogle, ready: googleReady } = useGoogleAuth(async (result) => {
    if (result.type === 'cancel') return;
    if (result.type === 'error') { setError(result.message); return; }
    setError('');
    setLoading(true);
    try {
      await googleLogin(result.idToken);
    } catch {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  });

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password, rememberMe);
    } catch (err) {
      setError(parseAuthError(err, 'login'));
    } finally {
      setLoading(false);
    }
  }

  function continueAsGuest() {
    navigation.reset({ index: 0, routes: [{ name: guestContinueTarget(seenOnboarding) }] });
  }

  // Staggered entrance: header → card → footer/guest → legal.
  const group = (delay: number) => slideUpSequence({ reduced, delay, duration: 320 });

  return (
    <Screen>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.bgDecor1} pointerEvents="none" />
      <View style={styles.bgDecor2} pointerEvents="none" />
      {/* Dismiss — only when pushed from the guest app (never in the old gate flow) */}
      {navigation.canGoBack() && (
        <PressableScale
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Close sign in"
        >
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </PressableScale>
      )}
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MotiView {...group(0)} style={styles.header}>
          <View style={styles.logoOuter}>
            <View style={styles.logoRing}>
              <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
          </View>
          <Text style={styles.appName}>T POKER</Text>
          <View style={styles.brandAccent} />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </MotiView>

        <MotiView {...group(80)} style={styles.card}>
          <View style={styles.form}>
            <AppTextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <AppTextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              error={error || undefined}
            />

            <PrimaryButton
              label="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.buttonTop}
            />

            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(v => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Ionicons name="checkmark" size={12} color={colors.background} />}
              </View>
              <Text style={styles.rememberLabel}>Stay signed in</Text>
            </TouchableOpacity>
          </View>

          {googleReady !== false && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>
              <GoogleAuthButton onPress={promptGoogle} disabled={!googleReady || loading} />
            </>
          )}
        </MotiView>

        <MotiView {...group(160)}>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <PressableScale
              onPress={() => navigation.navigate('Register')}
              hitSlop={8}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="Create an account"
            >
              <Text style={styles.link}>Create one</Text>
            </PressableScale>
          </View>

          {/* Guest escape hatch — entering guest mode is always one tap away. */}
          <PressableScale
            style={styles.guestLink}
            onPress={continueAsGuest}
            hitSlop={8}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Continue as guest"
          >
            <Text style={styles.guestLinkText}>Continue as guest</Text>
          </PressableScale>
        </MotiView>

        <MotiView {...group(220)} style={styles.legal}>
          <Text style={styles.legalText}>
            A private home-game scorekeeping app for adults (18+). Not a gambling
            product — play responsibly.
          </Text>
          <Text style={styles.brandByline}>BY TRUE STORY LABS</Text>
        </MotiView>
      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 48, justifyContent: 'center' },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bgDecor1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.goldFaint,
  },
  bgDecor2: {
    position: 'absolute',
    bottom: 60,
    left: -100,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.infoFaint,
    opacity: 0.35,
  },

  header: { alignItems: 'center', marginBottom: 36 },
  logoOuter: {
    width: 100,
    height: 100,
    borderRadius: 26,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...shadows.gold,
  },
  logoRing: {
    width: 84,
    height: 84,
    borderRadius: 20,
    overflow: 'hidden',
  },
  logo: { width: 84, height: 84, borderRadius: 20 },
  appName: { ...typography.caps, color: colors.gold, letterSpacing: 3, marginBottom: 8 },
  brandAccent: { width: 24, height: 2, borderRadius: 1, backgroundColor: colors.goldMuted, marginBottom: 16 },
  title: { ...typography.display, color: colors.text, marginBottom: 6 },
  subtitle: { ...typography.body, color: colors.textMuted },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 24,
    gap: 0,
    ...shadows.md,
  },
  form: { gap: 18 },
  buttonTop: { marginTop: 4 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.gold, borderColor: colors.gold },
  rememberLabel: { ...typography.bodySmall, color: colors.textMuted },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textDim },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  footerText: { ...typography.body, color: colors.textMuted },
  link: { ...typography.label, color: colors.gold },
  guestLink: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  guestLinkText: { ...typography.labelSmall, color: colors.textMuted },
  legal: { alignItems: 'center', marginTop: 24, paddingHorizontal: 12, gap: 10 },
  legalText: { ...typography.caption, color: colors.textDim, lineHeight: 17, textAlign: 'center' },
  brandByline: { ...typography.caps, fontSize: 10, color: colors.goldMuted, letterSpacing: 1.5 },
});
