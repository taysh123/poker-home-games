import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { getMyGroups, getGroupMembers, MyGroupDto, GroupMemberDto } from '../api/groupsApi';
import { createDebt } from '../api/debtsApi';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateDebt'>;

export default function CreateDebtScreen({ route, navigation }: Props) {
  const { user } = useAuth();

  const [groups, setGroups] = useState<MyGroupDto[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<MyGroupDto | null>(null);
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadGroups() {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (!token) return;
        const data = await getMyGroups(token);
        setGroups(data);
        // Pre-select group if passed via route params
        const preselect = route.params?.groupId
          ? data.find(g => g.id === route.params.groupId)
          : null;
        if (preselect) {
          setSelectedGroup(preselect);
        }
      } catch {
        Alert.alert('Error', 'Failed to load groups.');
      }
    }
    loadGroups();
  }, []);

  useEffect(() => {
    if (!selectedGroup) { setMembers([]); return; }
    setLoadingMembers(true);
    setFromUserId('');
    setToUserId('');
    async function loadMembers() {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (!token) return;
        const data = await getGroupMembers(token, selectedGroup!.id);
        setMembers(data);
        // Default: current user is the payer
        if (user?.userId) setFromUserId(user.userId);
      } catch {
        Alert.alert('Error', 'Failed to load group members.');
      } finally {
        setLoadingMembers(false);
      }
    }
    loadMembers();
  }, [selectedGroup?.id]);

  async function handleSubmit() {
    if (!selectedGroup) { Alert.alert('Missing', 'Please select a group.'); return; }
    if (!fromUserId) { Alert.alert('Missing', 'Please select who owes.'); return; }
    if (!toUserId) { Alert.alert('Missing', 'Please select who receives.'); return; }
    if (fromUserId === toUserId) { Alert.alert('Invalid', 'Payer and receiver must be different.'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      await createDebt(token, selectedGroup.id, fromUserId, toUserId, parsed, reason.trim() || undefined);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to record debt.');
    } finally {
      setSubmitting(false);
    }
  }

  const fromName = members.find(m => m.userId === fromUserId)?.username ?? '';
  const toName   = members.find(m => m.userId === toUserId)?.username ?? '';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Record a Debt</Text>

        {/* Group selection */}
        <Text style={styles.label}>GROUP</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {groups.map(g => (
              <TouchableOpacity
                key={g.id}
                style={[styles.chip, selectedGroup?.id === g.id && styles.chipSelected]}
                onPress={() => setSelectedGroup(g)}
              >
                <Text style={[styles.chipText, selectedGroup?.id === g.id && styles.chipTextSelected]}>
                  {g.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {loadingMembers ? (
          <ActivityIndicator color={colors.gold} style={{ marginBottom: 20 }} />
        ) : members.length > 0 ? (
          <>
            {/* Who owes */}
            <Text style={styles.label}>WHO OWES</Text>
            <View style={styles.memberGrid}>
              {members.map(m => (
                <TouchableOpacity
                  key={m.userId}
                  style={[styles.memberChip, fromUserId === m.userId && styles.memberChipSelected]}
                  onPress={() => setFromUserId(m.userId)}
                >
                  <Text style={[styles.memberChipText, fromUserId === m.userId && styles.memberChipTextSelected]}>
                    {m.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Arrow label */}
            {fromUserId && toUserId && (
              <View style={styles.directionRow}>
                <Text style={styles.directionText}>{fromName}</Text>
                <Text style={styles.directionArrow}> → </Text>
                <Text style={styles.directionText}>{toName}</Text>
              </View>
            )}

            {/* Who receives */}
            <Text style={styles.label}>WHO RECEIVES</Text>
            <View style={styles.memberGrid}>
              {members.map(m => (
                <TouchableOpacity
                  key={m.userId}
                  style={[styles.memberChip, toUserId === m.userId && styles.memberChipSelected]}
                  onPress={() => setToUserId(m.userId)}
                >
                  <Text style={[styles.memberChipText, toUserId === m.userId && styles.memberChipTextSelected]}>
                    {m.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : selectedGroup ? (
          <Text style={styles.emptyText}>No members found in this group.</Text>
        ) : null}

        {/* Amount */}
        <Text style={styles.label}>AMOUNT (₪)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textDim}
          value={amount}
          onChangeText={setAmount}
          editable={!submitting}
        />

        {/* Reason */}
        <Text style={styles.label}>REASON (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="e.g. lent cash for chips"
          placeholderTextColor={colors.textDim}
          value={reason}
          onChangeText={setReason}
          maxLength={200}
          multiline
          editable={!submitting}
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={colors.background} size="small" />
            : <Text style={styles.submitText}>Save Debt</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 24 },

  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.15)' },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  chipTextSelected: { color: colors.gold },

  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  memberChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  memberChipSelected: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.15)' },
  memberChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  memberChipTextSelected: { color: colors.gold },

  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  directionText: { fontSize: 15, fontWeight: '600', color: colors.text },
  directionArrow: { fontSize: 18, color: colors.gold, fontWeight: '700' },

  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  inputMultiline: { height: 72, textAlignVertical: 'top' },

  submitBtn: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: colors.background },

  emptyText: { fontSize: 14, color: colors.textMuted, marginBottom: 20 },
});
