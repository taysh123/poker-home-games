import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { joinGroupByInviteLink } from '../api/groupsApi';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinGroup'>;

export default function JoinGroupScreen({ route, navigation }: Props) {
  const { inviteToken } = route.params;
  const [status, setStatus] = useState<'joining' | 'success' | 'error'>('joining');
  const [errorMsg, setErrorMsg] = useState('');
  const [groupId, setGroupId] = useState('');
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-navigate to the group after a short delay once join succeeds
  useEffect(() => {
    if (status !== 'success') return;
    const timer = setTimeout(() => {
      navigation.replace('GroupDetail', { groupId, groupName });
    }, 1500);
    return () => clearTimeout(timer);
  }, [status, groupId, groupName, navigation]);

  async function join() {
    setStatus('joining');
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        setErrorMsg('You need to be logged in to join a group.');
        setStatus('error');
        return;
      }
      const result = await joinGroupByInviteLink(token, inviteToken);
      setGroupId(result.groupId);
      setGroupName(result.groupName);
      setStatus('success');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'This invite link is invalid or has expired.';
      setErrorMsg(msg);
      setStatus('error');
    }
  }

  if (status === 'joining') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
        <Text style={styles.joiningText}>Joining group…</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>✕</Text>
        <Text style={styles.errorTitle}>Couldn't join</Text>
        <Text style={styles.errorMsg}>{errorMsg}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.successIcon}>✓</Text>
      <Text style={styles.successTitle}>You're in!</Text>
      <Text style={styles.successSub}>You've joined {groupName}.</Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigation.replace('GroupDetail', { groupId, groupName })}
      >
        <Text style={styles.btnText}>Open Group</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  joiningText: { ...typography.body, color: colors.textMuted, marginTop: 8 },
  errorIcon: { fontSize: 48, color: colors.error },
  errorTitle: { ...typography.h2, color: colors.text },
  errorMsg: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  successIcon: { fontSize: 52, color: colors.success },
  successTitle: { ...typography.h1, color: colors.text },
  successSub: { fontSize: 15, color: colors.textMuted },
  btn: {
    marginTop: 8,
    backgroundColor: colors.gold,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: colors.background },
});
