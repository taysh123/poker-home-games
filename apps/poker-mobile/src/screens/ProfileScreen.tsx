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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { updateProfile, changePassword, deleteAccount } from '../api/profileApi';
import { RootStackParamList } from '../navigation/AppNavigator';

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

  const avatarLetter = (user?.username?.[0] ?? '?').toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <Text style={styles.avatarUsername}>{user?.username}</Text>
        </View>

        {/* ── Profile section ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PROFILE</Text>
            {!editingProfile && (
              <TouchableOpacity onPress={() => setEditingProfile(true)}>
                <Text style={styles.editLink}>Edit</Text>
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
          <Text style={styles.sectionTitle}>CHANGE PASSWORD</Text>
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

        {/* ── Danger Zone ─────────────────────────────────────────────── */}
        <View style={[styles.section, styles.dangerSection]}>
          <Text style={[styles.sectionTitle, { color: colors.error }]}>DANGER ZONE</Text>
          <Text style={styles.dangerDesc}>
            Permanently delete your account and all your data. This action cannot be undone.
          </Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger, deletingAccount && { opacity: 0.6 }]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount
              ? <ActivityIndicator size="small" color={colors.error} />
              : <Text style={styles.btnDangerText}>Delete Account</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },

  avatarWrap: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.gold },
  avatarUsername: { fontSize: 18, fontWeight: '700', color: colors.text },

  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
  },
  editLink: { fontSize: 13, fontWeight: '600', color: colors.gold },

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

  dangerSection: { borderColor: 'rgba(231,76,60,0.3)' },
  dangerDesc: { fontSize: 13, color: colors.textMuted, marginBottom: 14, lineHeight: 18 },
  btnDanger: { borderWidth: 1, borderColor: colors.error, paddingVertical: 11 },
  btnDangerText: { fontSize: 14, fontWeight: '700', color: colors.error },
});
