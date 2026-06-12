import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { USE_NATIVE_DRIVER } from '../theme/motion';
import { shadows } from '../theme/shadows';
import { useAuth } from '../context/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import GoogleAuthButton from '../components/GoogleAuthButton';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import AppTextInput from '../components/AppTextInput';
import { parseAuthError } from '../utils/parseAuthError';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register, googleLogin } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 8, tension: 80, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(formSlide, { toValue: 0, friction: 10, tension: 90, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ]).start();
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

  return (
    <Screen>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.bgDecor1} />
      <View style={styles.bgDecor2} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoOuter}>
            <View style={styles.logoRing}>
              <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
            </View>
          </View>
          <Text style={styles.appName}>T POKER</Text>
          <View style={styles.brandAccent} />
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join your first poker group</Text>
        </Animated.View>

        <Animated.View style={[styles.card, { opacity: formOpacity, transform: [{ translateY: formSlide }] }]}>
          <View style={styles.form}>
            <AppTextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="johndoe"
              autoCapitalize="none"
              autoCorrect={false}
            />
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
              label="Create Account"
              onPress={handleRegister}
              loading={loading}
              style={styles.buttonTop}
            />
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
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: formOpacity }]}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.link}>Sign In</Text>
          </TouchableOpacity>
        </Animated.View>
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
    backgroundColor: 'rgba(74,144,226,0.04)',
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
  appName: { fontSize: 11, fontWeight: '800', color: colors.gold, letterSpacing: 3, marginBottom: 8 },
  brandAccent: { width: 24, height: 2, borderRadius: 1, backgroundColor: colors.goldMuted, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textMuted },

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
  dividerText: { color: colors.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: colors.textMuted, fontSize: 15 },
  link: { color: colors.gold, fontSize: 15, fontWeight: '700' },
});
