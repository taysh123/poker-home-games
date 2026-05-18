import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { createSession } from '../api/sessionsApi';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateSession'>;

export default function CreateSessionScreen({ route, navigation }: Props) {
  const { groupId } = route.params;

  const [name, setName] = useState('');
  const [smallBlind, setSmallBlind] = useState('');
  const [bigBlind, setBigBlind] = useState('');
  const [chipRatio, setChipRatio] = useState('');
  const [defaultBuyIn, setDefaultBuyIn] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: 'New Session',
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' },
    });
  }, [navigation]);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Session name is required.');
      return;
    }
    const sb = parseFloat(smallBlind);
    const bb = parseFloat(bigBlind);
    if (isNaN(sb) || sb <= 0) {
      setError('Small blind must be greater than 0.');
      return;
    }
    if (isNaN(bb) || bb < sb) {
      setError('Big blind must be greater than or equal to small blind.');
      return;
    }
    const cr = chipRatio ? parseFloat(chipRatio) : undefined;
    const dbi = defaultBuyIn ? parseFloat(defaultBuyIn) : undefined;
    if (cr !== undefined && (isNaN(cr) || cr <= 0)) {
      setError('Chip ratio must be greater than 0.');
      return;
    }
    if (dbi !== undefined && (isNaN(dbi) || dbi <= 0)) {
      setError('Default buy-in must be greater than 0.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Not authenticated');
      const session = await createSession(token, groupId, name.trim(), sb, bb, cr, dbi);
      navigation.goBack();
      navigation.navigate('SessionDetail', {
        sessionId: session.id,
        sessionName: session.name,
        userRole: 'Owner',
      });
    } catch (err: any) {
      const msg = err?.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(', ')
        : err?.response?.data?.message ?? 'Failed to create session.';
      setError(msg as string);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Session Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Friday Night Game"
          placeholderTextColor={colors.textDim}
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoFocus
        />
        <Text style={styles.charCount}>{name.length}/100</Text>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Small Blind</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.textDim}
              value={smallBlind}
              onChangeText={setSmallBlind}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Big Blind</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.textDim}
              value={bigBlind}
              onChangeText={setBigBlind}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Chip Ratio (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 100"
              placeholderTextColor={colors.textDim}
              value={chipRatio}
              onChangeText={setChipRatio}
              keyboardType="decimal-pad"
            />
            <Text style={styles.hint}>chips per ₪</Text>
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Default Buy-In ₪ (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50"
              placeholderTextColor={colors.textDim}
              value={defaultBuyIn}
              onChangeText={setDefaultBuyIn}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Create Session</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 24, gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  charCount: {
    fontSize: 11,
    color: colors.textDim,
    textAlign: 'right',
    marginTop: 4,
  },
  hint: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 4,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  button: {
    marginTop: 28,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.background },
});
