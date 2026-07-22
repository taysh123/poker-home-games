import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { useAuth } from '../context/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useAppleAuth } from '../hooks/useAppleAuth';
import GoogleAuthButton from '../components/GoogleAuthButton';
import AppleAuthButton from '../components/AppleAuthButton';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import AppTextInput from '../components/AppTextInput';
import PressableScale from '../components/motion/PressableScale';
import { MotiView, slideUpSequence } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { parseAuthError } from '../utils/parseAuthError';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register, googleLogin, appleLogin } = useAuth();
  const reduced = useReducedMotion();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  // Sign in with Apple — iOS only (Guideline 4.8: Google sign-in on iOS requires an Apple option).
  const { prompt: promptApple, available: appleAvailable } = useAppleAuth(async (result) => {
    if (result.type === 'cancel') return;
    if (result.type === 'error') { setError(result.message); return; }
    setError('');
    setLoading(true);
    try {
      await appleLogin(result.identityToken, result.nonce);
    } catch {
      setError('Apple sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  });

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
    } catch (err) {
      setError(parseAuthError(err, 'register'));
    } finally {
      setLoading(false);
    }
  }

  // Staggered entrance: header → card → footer (same rhythm as Login).
  const group = (delay: number) => slideUpSequence({ reduced, delay, duration: 320 });

  return (
    <Screen>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.bgDecor1} pointerEvents="none" />
      <View style={styles.bgDecor2} pointerEvents="none" />
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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join your first poker group</Text>
        </MotiView>

        <MotiView {...group(80)} style={styles.card}>
          <View style={styles.form}>
            <AppTextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="johndoe"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
            />
            <AppTextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <AppTextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              error={error || undefined}
            />

            <PrimaryButton
              label="Create Account"
              onPress={handleRegister}
              loading={loading}
              style={styles.buttonTop}
            />
          </View>

          {(googleReady !== false || appleAvailable) && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>
              {googleReady !== false && (
                <GoogleAuthButton onPress={promptGoogle} disabled={!googleReady || loading} />
              )}
              {appleAvailable && (
                <AppleAuthButton
                  onPress={promptApple}
                  disabled={loading}
                  style={googleReady !== false ? styles.appleButton : undefined}
                />
              )}
            </>
          )}
        </MotiView>

        <MotiView {...group(160)} style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <PressableScale
            onPress={() => navigation.goBack()}
            hitSlop={8}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Sign in to your account"
          >
            <Text style={styles.link}>Sign In</Text>
          </PressableScale>
        </MotiView>
      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 48, justifyContent: 'center' },

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
    ...shadows.md,
  },
  form: { gap: 18 },
  buttonTop: { marginTop: 4 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  // textMuted (not textDim): 12px caption on the surface card must clear WCAG AA contrast.
  dividerText: { ...typography.caption, color: colors.textMuted },
  appleButton: { marginTop: 12 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  footerText: { ...typography.body, color: colors.textMuted },
  link: { ...typography.label, color: colors.gold },
});
