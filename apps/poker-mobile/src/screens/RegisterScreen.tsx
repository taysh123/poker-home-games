import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import GoogleAuthButton from '../components/GoogleAuthButton';
import PrimaryButton from '../components/PrimaryButton';
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.suit}>♣</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join your first poker group</Text>
        </View>

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
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <GoogleAuthButton onPress={promptGoogle} disabled={!googleReady || loading} />
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.link}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  suit: { fontSize: 52, color: colors.gold, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 15, color: colors.textMuted },
  form: { gap: 20 },
  buttonTop: { marginTop: 8 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 36 },
  footerText: { color: colors.textMuted, fontSize: 15 },
  link: { color: colors.gold, fontSize: 15, fontWeight: '600' },
});
