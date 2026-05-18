import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { updateGroup } from '../api/groupsApi';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'EditGroup'>;

const MAX_NAME = 100;
const MAX_DESC = 500;

export default function EditGroupScreen({ route, navigation }: Props) {
  const { groupId, groupName: initialName, description: initialDesc } = route.params;

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Group name is required.');
      return;
    }
    if (trimmedName.length > MAX_NAME) {
      setError(`Name must be ${MAX_NAME} characters or fewer.`);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      await updateGroup(token, groupId, trimmedName, description.trim() || undefined);
      navigation.goBack();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.title ??
        'Failed to update group.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const canSave = name.trim().length > 0 && name.trim().length <= MAX_NAME && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Group Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter group name"
          placeholderTextColor={colors.textDim}
          maxLength={MAX_NAME}
          autoFocus
          returnKeyType="next"
        />
        <Text style={styles.charCount}>{name.length}/{MAX_NAME}</Text>

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="What's this group about?"
          placeholderTextColor={colors.textDim}
          maxLength={MAX_DESC}
          multiline
          numberOfLines={3}
        />
        <Text style={styles.charCount}>{description.length}/{MAX_DESC}</Text>

        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, paddingBottom: 40 },
  cancelText: { color: colors.textMuted, fontSize: 16 },
  errorBanner: {
    backgroundColor: 'rgba(231,76,60,0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: colors.error, fontSize: 14, textAlign: 'center' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  charCount: {
    fontSize: 11,
    color: colors.textDim,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 4,
  },
  saveButton: {
    marginTop: 32,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: colors.background },
});
