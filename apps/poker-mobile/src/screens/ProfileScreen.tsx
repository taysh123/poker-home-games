import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Switch,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { isFeatureEnabled } from '../config/features';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { useAuth } from '../context/AuthContext';
import { updateProfile, changePassword, deleteAccount } from '../api/profileApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import RankBadge from '../components/RankBadge';
import CloudSyncCard from '../components/CloudSyncCard';
import AppTextInput from '../components/AppTextInput';
import PrimaryButton from '../components/PrimaryButton';
import { PressableScale, MotiView, slideUpSequence, staggerIn } from '../components/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useCurrency } from '../context/CurrencyContext';
import Avatar from '../components/Avatar';
import { AVATAR_COLORS } from '../utils/avatarColor';
import { confirmDialog } from '../utils/confirm';
import { showToast } from '../utils/toast';
import { track, setAnalyticsOptOut, isAnalyticsSharingEnabled } from '../utils/analytics';

// Curated identity emojis — poker-flavored plus broadly fun picks.
const IDENTITY_EMOJIS = [
  '🃏', '♠️', '♥️', '♦️', '♣️', '🎲', '💰', '👑',
  '🦈', '🦊', '🐺', '🦅', '🐯', '🐉', '🦂', '🃟',
  '😎', '🤠', '🧐', '😈', '🥷', '🤖', '👻', '🍀',
];

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { user, updateUser, logout } = useAuth();
  const { code: currencyCode } = useCurrency();
  const reduced = useReducedMotion();

  // Wave 0.2 — anonymous-usage-analytics sharing toggle (consent stays; this is the opt-out).
  const [analyticsSharing, setAnalyticsSharing] = useState(isAnalyticsSharingEnabled());
  function toggleAnalyticsSharing(next: boolean) {
    setAnalyticsSharing(next);
    void setAnalyticsOptOut(!next);
  }
  // Premium-teaser impression — once per screen visit (paywall OFF ⇒ the teaser row renders).
  React.useEffect(() => {
    if (!isFeatureEnabled('paywall')) track('nudge_impression', { trigger: 'profile_teaser', paywallOn: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Profile edit state
  const [editingProfile, setEditingProfile] = useState(false);
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [deletingAccount, setDeletingAccount] = useState(false);

  // Identity (emoji + color) state
  const [pendingEmoji, setPendingEmoji] = useState(user?.avatarEmoji ?? '');
  const [pendingColor, setPendingColor] = useState(user?.avatarColor ?? '');
  const [savingIdentity, setSavingIdentity] = useState(false);
  const identityDirty =
    pendingEmoji !== (user?.avatarEmoji ?? '') || pendingColor !== (user?.avatarColor ?? '');

  async function handleSaveIdentity() {
    setSavingIdentity(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const response = await updateProfile(token, undefined, undefined, {
        avatarEmoji: pendingEmoji,
        avatarColor: pendingColor,
      });
      updateUser({ avatarEmoji: response.avatarEmoji, avatarColor: response.avatarColor });
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Failed to update identity.', 'error');
    } finally {
      setSavingIdentity(false);
    }
  }

  async function handleSaveProfile() {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedUsername || !trimmedEmail) {
      showToast('Username and email are required.', 'error');
      return;
    }
    if (trimmedUsername === user?.username && trimmedEmail === user?.email) {
      setEditingProfile(false);
      return;
    }
    setSavingProfile(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      const response = await updateProfile(
        token,
        trimmedUsername !== user?.username ? trimmedUsername : undefined,
        trimmedEmail !== user?.email ? trimmedEmail : undefined,
      );
      updateUser({ username: response.username, email: response.email });
      setEditingProfile(false);
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  function handleCancelEdit() {
    setUsername(user?.username ?? '');
    setEmail(user?.email ?? '');
    setEditingProfile(false);
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('Please fill in all password fields.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters.', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await changePassword(token, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed successfully.', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Failed to change password.', 'error');
    } finally {
      setSavingPassword(false);
    }
  }

  function handleDeleteAccount() {
    confirmDialog(
      'Delete Account',
      'This will permanently delete your account and all associated data. This cannot be undone.',
      'Delete',
      confirmDelete,
      { destructive: true },
    );
  }

  async function confirmDelete() {
    setDeletingAccount(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await deleteAccount(token);
      await logout();
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Failed to delete account.', 'error');
      setDeletingAccount(false);
    }
  }

  // Velvet Table header (replaces the old native navigation header)
  const header = (
    <ScreenHeader title="My Profile" onBack={() => navigation.goBack()} />
  );

  return (
    <Screen>
    {header}
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Identity hero */}
        <MotiView style={styles.avatarWrap} {...slideUpSequence({ reduced })}>
          <LinearGradient
            colors={[colors.goldFaint, 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.avatarGlow}
            pointerEvents="none"
          />
          <Avatar
            name={user?.username ?? '?'}
            emoji={user?.avatarEmoji}
            color={user?.avatarColor}
            size={88}
            ring="gold"
          />
          <Text style={styles.avatarUsername} numberOfLines={1}>{user?.username}</Text>
          <Text style={styles.avatarEmail} numberOfLines={1}>{user?.email}</Text>
        </MotiView>

        {/* Rank / XP — tap for all achievements (retention only; renders null when off) */}
        <RankBadge onPress={() => navigation.navigate('Achievements')} />

        {/* ── Identity section ────────────────────────────────────────── */}
        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(1) })}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="color-palette-outline" size={14} color={colors.gold} />
              </View>
              <Text style={styles.sectionTitle}>Identity</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>EMOJI</Text>
          <View style={styles.identityGrid}>
            <PressableScale
              style={[styles.emojiCell, !pendingEmoji && styles.identityCellSelected]}
              onPress={() => setPendingEmoji('')}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="Use your initial as your avatar"
              accessibilityState={{ selected: !pendingEmoji }}
            >
              <Text style={styles.emojiInitial}>{(user?.username?.[0] ?? '?').toUpperCase()}</Text>
            </PressableScale>
            {IDENTITY_EMOJIS.map(e => (
              <PressableScale
                key={e}
                style={[styles.emojiCell, pendingEmoji === e && styles.identityCellSelected]}
                onPress={() => setPendingEmoji(e)}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={`Avatar emoji ${e}`}
                accessibilityState={{ selected: pendingEmoji === e }}
              >
                <Text style={styles.emojiText} allowFontScaling={false}>{e}</Text>
              </PressableScale>
            ))}
          </View>

          <Text style={styles.fieldLabel}>COLOR</Text>
          <View style={styles.identityGrid}>
            {AVATAR_COLORS.map((c, i) => (
              <PressableScale
                key={c}
                style={[
                  styles.colorCell,
                  { backgroundColor: c },
                  pendingColor === c && styles.colorCellSelected,
                ]}
                onPress={() => setPendingColor(c)}
                haptic="light"
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Avatar color ${i + 1}`}
                accessibilityState={{ selected: pendingColor === c }}
              />
            ))}
          </View>

          {identityDirty && (
            <PrimaryButton
              label="Save Identity"
              onPress={handleSaveIdentity}
              loading={savingIdentity}
              style={styles.identitySaveBtn}
            />
          )}
        </View>
        </MotiView>

        {/* ── Profile section ─────────────────────────────────────────── */}
        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(2) })}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="person-outline" size={14} color={colors.gold} />
              </View>
              <Text style={styles.sectionTitle}>Profile</Text>
            </View>
            {!editingProfile && (
              <PressableScale
                style={styles.editIconBtn}
                onPress={() => setEditingProfile(true)}
                hitSlop={8}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
              >
                <Ionicons name="create-outline" size={16} color={colors.gold} />
              </PressableScale>
            )}
          </View>

          {editingProfile ? (
            <View style={styles.inputGroup}>
              <AppTextInput
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
                editable={!savingProfile}
              />
              <AppTextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="done"
                editable={!savingProfile}
              />
              <View style={styles.editBtns}>
                <PrimaryButton
                  variant="outline"
                  label="Cancel"
                  fullWidth={false}
                  style={styles.flexBtn}
                  onPress={handleCancelEdit}
                  disabled={savingProfile}
                />
                <PrimaryButton
                  label="Save"
                  fullWidth={false}
                  style={styles.flexBtn}
                  onPress={handleSaveProfile}
                  loading={savingProfile}
                />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>USERNAME</Text>
                <Text style={styles.fieldValue}>{user?.username}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>EMAIL</Text>
                <Text style={styles.fieldValue}>{user?.email}</Text>
              </View>
            </>
          )}
        </View>
        </MotiView>

        {/* ── Change Password section ──────────────────────────────────── */}
        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(3) })}>
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { marginBottom: 14 }]}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.gold} />
              </View>
              <Text style={styles.sectionTitle}>Change Password</Text>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <AppTextInput
              label="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              placeholder="••••••••"
              autoComplete="current-password"
              textContentType="password"
              editable={!savingPassword}
            />
            <AppTextInput
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="••••••••"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!savingPassword}
            />
            <AppTextInput
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="••••••••"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!savingPassword}
            />
            <PrimaryButton
              label="Change Password"
              onPress={handleChangePassword}
              loading={savingPassword}
            />
          </View>
        </View>
        </MotiView>

        {/* ── Cloud Sync (honest Coming-soon until cloud_sync is live) ──── */}
        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(4) })}>
          <CloudSyncCard onGoPremium={() => navigation.navigate('Paywall', { trigger: 'profile' })} />
        </MotiView>

        {/* ── Premium teaser (free-first): deliberately NOT paywall-gated — the destination's
               flag-OFF branch is the honest Coming-soon preview (no plans, no purchase, no
               restore; pinned by the honesty guards). Builds desire, sells nothing. ── */}
        {!isFeatureEnabled('paywall') && (
          <MotiView {...slideUpSequence({ reduced, delay: staggerIn(4) })}>
            <PressableScale
              style={styles.aboutRow}
              onPress={() => navigation.navigate('Paywall', { trigger: 'profile_teaser' })}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="Premium, coming soon — see what's planned"
            >
              <Ionicons name="sparkles-outline" size={16} color={colors.gold} />
              <Text style={styles.aboutRowText}>Premium</Text>
              <Text style={styles.aboutRowValue}>Coming soon</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
            </PressableScale>
          </MotiView>
        )}

        {/* ── Subscription & usage (flag-gated) ─────────────────────────── */}
        {isFeatureEnabled('paywall') && (
          <MotiView {...slideUpSequence({ reduced, delay: staggerIn(4) })}>
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="sparkles-outline" size={14} color={colors.gold} />
                </View>
                <Text style={styles.sectionTitle}>Subscription & usage</Text>
              </View>
            </View>
            <PressableScale
              style={styles.aboutRow}
              onPress={() => navigation.navigate('Paywall', { trigger: 'profile' })}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="T Poker Premium"
            >
              <Ionicons name="star-outline" size={16} color={colors.textMuted} />
              <Text style={styles.aboutRowText}>T Poker Premium</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
            </PressableScale>
          </View>
          </MotiView>
        )}

        {isFeatureEnabled('reminders') && (
          <MotiView {...slideUpSequence({ reduced, delay: staggerIn(4) })}>
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="notifications-outline" size={14} color={colors.gold} />
                </View>
                <Text style={styles.sectionTitle}>Reminders</Text>
              </View>
            </View>
            <PressableScale style={styles.aboutRow} onPress={() => navigation.navigate('NotificationPreferences')} haptic="light" accessibilityRole="button" accessibilityLabel="Reminder preferences">
              <Ionicons name="alarm-outline" size={16} color={colors.textMuted} />
              <Text style={styles.aboutRowText}>Reminder preferences</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
            </PressableScale>
          </View>
          </MotiView>
        )}

        {isFeatureEnabled('currencyPrefs') && (
          <MotiView {...slideUpSequence({ reduced, delay: staggerIn(4) })}>
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="cash-outline" size={14} color={colors.gold} />
                </View>
                <Text style={styles.sectionTitle}>Display</Text>
              </View>
            </View>
            <PressableScale style={styles.aboutRow} onPress={() => navigation.navigate('CurrencyPicker')} haptic="light" accessibilityRole="button" accessibilityLabel={`Preferred currency, currently ${currencyCode}`}>
              <Ionicons name="globe-outline" size={16} color={colors.textMuted} />
              <Text style={styles.aboutRowText}>Currency</Text>
              <Text style={styles.aboutRowValue}>{currencyCode}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
            </PressableScale>
          </View>
          </MotiView>
        )}

        {/* ── Personalization — retake the setup quiz (1.3) ── */}
        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(5) })}>
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="options-outline" size={14} color={colors.gold} />
              </View>
              <Text style={styles.sectionTitle}>Personalization</Text>
            </View>
          </View>
          <PressableScale
            style={styles.aboutRow}
            onPress={() => navigation.navigate('PersonaQuiz')}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Retake the setup quiz"
          >
            <Ionicons name="options-outline" size={16} color={colors.textMuted} />
            <Text style={styles.aboutRowText}>Retake the setup quiz</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
          </PressableScale>
        </View>
        </MotiView>

        {/* ── Privacy — anonymous usage analytics (Wave 0.2, opt-out any time) ── */}
        {isFeatureEnabled('analytics') && (
          <MotiView {...slideUpSequence({ reduced, delay: staggerIn(5) })}>
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={colors.gold} />
                </View>
                <Text style={styles.sectionTitle}>Privacy</Text>
              </View>
            </View>
            <View style={styles.aboutRow} accessible accessibilityRole="switch" accessibilityState={{ checked: analyticsSharing }} accessibilityLabel="Share anonymous usage analytics">
              <Ionicons name="pulse-outline" size={16} color={colors.textMuted} />
              <Text style={styles.aboutRowText}>Share anonymous usage analytics</Text>
              <Switch
                value={analyticsSharing}
                onValueChange={toggleAnalyticsSharing}
                trackColor={{ false: colors.border, true: colors.goldMuted }}
                thumbColor={analyticsSharing ? colors.gold : colors.textDim}
              />
            </View>
            <Text style={styles.privacyHint}>
              Feature usage only — never your game amounts, player names, or hands.
            </Text>
          </View>
          </MotiView>
        )}

        {/* ── About & Support ─────────────────────────────────────────── */}
        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(5) })}>
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="information-circle-outline" size={14} color={colors.gold} />
              </View>
              <Text style={styles.sectionTitle}>About & Support</Text>
            </View>
          </View>

          <PressableScale
            style={styles.aboutRow}
            onPress={() => Linking.openURL('mailto:truestorylabs@gmail.com?subject=T%20Poker%20support')}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Email support at truestorylabs@gmail.com"
          >
            <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
            <Text style={styles.aboutRowText}>truestorylabs@gmail.com</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
          </PressableScale>

          <PressableScale
            style={styles.aboutRow}
            onPress={() => Linking.openURL('https://poker-home-games-three.vercel.app/privacy.html')}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Open privacy policy"
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
            <Text style={styles.aboutRowText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
          </PressableScale>

          <PressableScale
            style={styles.aboutRow}
            onPress={() => Linking.openURL('https://poker-home-games-three.vercel.app/terms.html')}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Open terms of service"
          >
            <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
            <Text style={styles.aboutRowText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
          </PressableScale>

          <Text style={styles.aboutResponsible}>
            T Poker is a private home-game scorekeeping app for adults (18+). It is not
            a gambling product — play responsibly and within the law.
          </Text>
          <Text style={styles.aboutMeta}>
            v{Constants.expoConfig?.version ?? '1.1.0'} · © True Story Labs
          </Text>
        </View>
        </MotiView>

        {/* ── Danger Zone ─────────────────────────────────────────────── */}
        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(6) })}>
        <View style={[styles.section, styles.dangerSection]}>
          <View style={[styles.sectionHeader, { marginBottom: 10 }]}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconWrap, styles.sectionIconWrapDanger]}>
                <Ionicons name="warning-outline" size={14} color={colors.error} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.error }]}>Danger Zone</Text>
            </View>
          </View>
          <Text style={styles.dangerDesc}>
            Permanently delete your account and all your data. This action cannot be undone.
          </Text>
          <PressableScale
            style={[styles.btnDanger, deletingAccount && styles.dimmed]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            accessibilityState={{ disabled: deletingAccount, busy: deletingAccount }}
          >
            {deletingAccount
              ? <ActivityIndicator size="small" color={colors.error} />
              : (
                <>
                  <Ionicons name="trash-outline" size={15} color={colors.error} />
                  <Text style={styles.btnDangerText}>Delete Account</Text>
                </>
              )}
          </PressableScale>
        </View>
        </MotiView>

      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  avatarWrap: { alignItems: 'center', marginBottom: 28, marginTop: 8, gap: 6 },
  avatarGlow: { position: 'absolute', top: -16, width: 260, height: 150, alignSelf: 'center' },
  // Identity picker
  identityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  emojiCell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCellSelected: { borderColor: colors.gold, backgroundColor: colors.goldFaint },
  emojiText: { fontSize: 22 },
  emojiInitial: { fontSize: 18, fontWeight: '800', color: colors.goldLight },
  colorCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCellSelected: { borderColor: colors.text },
  identitySaveBtn: { marginTop: 4 },

  avatarUsername: { ...typography.displaySerif, fontSize: 24, color: colors.text, marginTop: 4 },
  avatarEmail: { ...typography.bodySmall, color: colors.textMuted },

  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...shadows.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconWrapDanger: {
    backgroundColor: colors.errorFaint,
    borderColor: colors.errorMuted,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 0,
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldRow: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  fieldValue: { fontSize: 15, color: colors.text, fontWeight: '500' },

  inputGroup: { gap: 14 },
  editBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  flexBtn: { flex: 1 },
  dimmed: { opacity: 0.6 },

  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  aboutRowText: { flex: 1, fontSize: 14, color: colors.textHigh, fontWeight: '500' },
  aboutRowValue: { fontSize: 13, color: colors.gold, fontWeight: '600', marginRight: 6 },
  privacyHint: { fontSize: 12, color: colors.textMuted, marginTop: 6, marginLeft: 4, lineHeight: 17 },
  aboutResponsible: {
    fontSize: 12,
    color: colors.textDim,
    lineHeight: 18,
    marginTop: 14,
  },
  aboutMeta: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 12,
    letterSpacing: 0.3,
  },

  dangerSection: { borderColor: colors.errorMuted },
  dangerDesc: { fontSize: 13, color: colors.textMuted, marginBottom: 14, lineHeight: 18 },
  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.errorMuted,
    backgroundColor: colors.errorFaint,
    paddingVertical: 13,
    minHeight: 48,
    borderRadius: 12,
  },
  btnDangerText: { fontSize: 14, fontWeight: '700', color: colors.error },
});
