import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { createGroup } from '../api/groupsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

export default function CreateGroupScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Velvet Table header (replaces the old native navigation header)
  const header = (
    <ScreenHeader title="Create Group" onBack={() => navigation.goBack()} />
  );

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Group name is required.');
      return;
    }
    if (trimmedName.length > 50) {
      setError('Name must be 50 characters or fewer.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const group = await createGroup(token, trimmedName, description.trim() || undefined);
      navigation.replace('GroupDetail', {
        groupId: group.id,
        groupName: group.name,
        showInviteOnLoad: true,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.errors
          ? Object.values(err.response.data.errors).flat().join(' ')
          : err?.response?.data?.message ?? 'Failed to create group. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
    {header}
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Group Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Friday Night Poker"
          placeholderTextColor={colors.textDim}
          value={name}
          onChangeText={setName}
          maxLength={50}
          autoFocus
          returnKeyType="next"
        />
        <Text style={styles.charCount}>{name.length}/50</Text>

        <Text style={[styles.label, styles.labelSpacing]}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Optional — what's this group about?"
          placeholderTextColor={colors.textDim}
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          multiline
          numberOfLines={3}
          returnKeyType="done"
        />
        <Text style={styles.charCount}>{description.length}/200</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.createButton, (!name.trim() || loading) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={styles.createButtonText}>Create Group</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  labelSpacing: {
    marginTop: 20,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  charCount: {
    fontSize: 11,
    color: colors.textDim,
    textAlign: 'right',
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 16,
    textAlign: 'center',
  },
  createButton: {
    marginTop: 32,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.background,
  },
});
