import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { useAuth } from '../context/AuthContext';
import { updateProfile, changePassword, deleteAccount } from '../api/profileApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import { AVATAR_COLORS } from '../utils/avatarColor';

// Curated identity emojis — poker-flavored plus broadly fun picks.
const IDENTITY_EMOJIS = [
  '🃏', '♠️', '♥️', '♦️', '♣️', '🎲', '💰', '👑',
  '🦈', '🦊', '🐺', '🦅', '🐯', '🐉', '🦂', '🃟',
  '😎', '🤠', '🧐', '😈', '🥷', '🤖', '👻', '🍀',
];

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { user, updateUser, logout } = useAuth();

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
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to update identity.');
    } finally {
      setSavingIdentity(false);
    }
  }

  async function handleSaveProfile() {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedUsername || !trimmedEmail) {
      Alert.alert('Missing', 'Username and email are required.');
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
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to update profile.');
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
      Alert.alert('Missing', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
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
      Alert.alert('Success', 'Password changed successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ],
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
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to delete account.');
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

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <Avatar
            name={user?.username ?? '?'}
            emoji={user?.avatarEmoji}
            color={user?.avatarColor}
            size={84}
            ring="gold"
          />
          <Text style={styles.avatarUsername}>{user?.username}</Text>
          <Text style={styles.avatarEmail}>{user?.email}</Text>
        </View>

        {/* ── Identity section ────────────────────────────────────────── */}
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
            <TouchableOpacity
              style={[styles.emojiCell, !pendingEmoji && styles.identityCellSelected]}
              onPress={() => setPendingEmoji('')}
            >
              <Text style={styles.emojiInitial}>{(user?.username?.[0] ?? '?').toUpperCase()}</Text>
            </TouchableOpacity>
            {IDENTITY_EMOJIS.map(e => (
              <TouchableOpacity
                key={e}
                style={[styles.emojiCell, pendingEmoji === e && styles.identityCellSelected]}
                onPress={() => setPendingEmoji(e)}
              >
                <Text style={styles.emojiText} allowFontScaling={false}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>COLOR</Text>
          <View style={styles.identityGrid}>
            {AVATAR_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorCell,
                  { backgroundColor: c },
                  pendingColor === c && styles.colorCellSelected,
                ]}
                onPress={() => setPendingColor(c)}
              />
            ))}
          </View>

          {identityDirty && (
            <TouchableOpacity
              style={[styles.saveBtn, savingIdentity && { opacity: 0.6 }]}
              onPress={handleSaveIdentity}
              disabled={savingIdentity}
            >
              {savingIdentity
                ? <ActivityIndicator size="small" color={colors.background} />
                : <Text style={styles.saveBtnText}>Save Identity</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Profile section ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="person-outline" size={14} color={colors.gold} />
              </View>
              <Text style={styles.sectionTitle}>Profile</Text>
            </View>
            {!editingProfile && (
              <TouchableOpacity style={styles.editIconBtn} onPress={() => setEditingProfile(true)} hitSlop={8}>
                <Ionicons name="create-outline" size={16} color={colors.gold} />
              </TouchableOpacity>
            )}
          </View>

          {editingProfile ? (
            <>
              <Text style={styles.fieldLabel}>USERNAME</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!savingProfile}
              />
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!savingProfile}
              />
              <View style={styles.editBtns}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={handleCancelEdit}
                  disabled={savingProfile}
                >
                  <Text style={styles.btnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, savingProfile && { opacity: 0.6 }]}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile
                    ? <ActivityIndicator size="small" color={colors.background} />
                    : <Text style={styles.btnPrimaryText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </>
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

        {/* ── Change Password section ──────────────────────────────────── */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { marginBottom: 14 }]}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.gold} />
              </View>
              <Text style={styles.sectionTitle}>Change Password</Text>
            </View>
          </View>
          <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.textDim}
            editable={!savingPassword}
          />
          <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.textDim}
            editable={!savingPassword}
          />
          <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.textDim}
            editable={!savingPassword}
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, styles.btnFull, savingPassword && { opacity: 0.6 }]}
            onPress={handleChangePassword}
            disabled={savingPassword}
          >
            {savingPassword
              ? <ActivityIndicator size="small" color={colors.background} />
              : <Text style={styles.btnPrimaryText}>Change Password</Text>}
          </TouchableOpacity>
        </View>

        {/* ── About & Support ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="information-circle-outline" size={14} color={colors.gold} />
              </View>
              <Text style={styles.sectionTitle}>About & Support</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.aboutRow}
            onPress={() => Linking.openURL('mailto:truestorylabs@gmail.com?subject=T%20Poker%20support')}
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
            <Text style={styles.aboutRowText}>truestorylabs@gmail.com</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.aboutRow}
            onPress={() => Linking.openURL('https://poker-home-games-three.vercel.app/privacy.html')}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
            <Text style={styles.aboutRowText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
          </TouchableOpacity>

          <Text style={styles.aboutResponsible}>
            T Poker is a private home-game scorekeeping app for adults (18+). It is not
            a gambling product — play responsibly and within the law.
          </Text>
          <Text style={styles.aboutMeta}>
            v{Constants.expoConfig?.version ?? '1.1.0'} · © True Story Labs
          </Text>
        </View>

        {/* ── Danger Zone ─────────────────────────────────────────────── */}
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
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger, deletingAccount && { opacity: 0.6 }]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            activeOpacity={0.75}
          >
            {deletingAccount
              ? <ActivityIndicator size="small" color={colors.error} />
              : (
                <>
                  <Ionicons name="trash-outline" size={15} color={colors.error} />
                  <Text style={styles.btnDangerText}>Delete Account</Text>
                </>
              )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  avatarWrap: { alignItems: 'center', marginBottom: 28, marginTop: 8, gap: 6 },
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
  saveBtn: {
    marginTop: 4,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: colors.background },

  avatarOuter: {
    width: 86,
    height: 86,
    borderRadius: 24,
    backgroundColor: colors.goldFaint,
    borderWidth: 1.5,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    ...shadows.goldSm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: colors.gold },
  avatarUsername: { fontSize: 18, fontWeight: '700', color: colors.text },
  avatarEmail: { fontSize: 13, color: colors.textMuted },

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

  input: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 14,
  },

  editBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  btnFull: { marginTop: 4 },
  btnPrimary: { flex: 1, backgroundColor: colors.gold },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: colors.background },
  btnSecondary: { flex: 1, borderWidth: 1, borderColor: colors.border },
  btnSecondaryText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },

  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  aboutRowText: { flex: 1, fontSize: 14, color: colors.textHigh, fontWeight: '500' },
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
    borderRadius: 12,
  },
  btnDangerText: { fontSize: 14, fontWeight: '700', color: colors.error },
});
