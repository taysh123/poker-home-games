import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { joinSessionByToken } from '../api/sessionsApi';
import { RootStackParamList } from '../navigation/AppNavigator';
import { savePendingInvite } from '../utils/pendingInvite';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinSession'>;

export default function JoinSessionScreen({ route, navigation }: Props) {
  const { inviteToken } = route.params;
  const [status, setStatus] = useState<'joining' | 'success' | 'error' | 'signin'>('joining');
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [groupId, setGroupId] = useState('');

  useEffect(() => {
    join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function join() {
    setStatus('joining');
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        // Guest opened an invite link — stash it and offer sign-in; the join
        // continues automatically after login (see AppNavigator).
        setStatus('signin');
        return;
      }
      const result = await joinSessionByToken(token, inviteToken);
      setSessionId(result.sessionId);
      setGroupId(result.groupId ?? '');
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
        <Text style={styles.joiningText}>Joining session…</Text>
      </View>
    );
  }

  if (status === 'signin') {
    return (
      <View style={styles.center}>
        <View style={styles.successIconWrap}><Ionicons name="mail-open-outline" size={48} color={colors.gold} /></View>
        <Text style={styles.errorTitle}>You're invited!</Text>
        <Text style={styles.errorMsg}>Sign in to join this game — we'll take you straight back here.</Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={async () => {
            await savePendingInvite('session', inviteToken);
            navigation.navigate('Login');
          }}
        >
          <Text style={styles.btnText}>Sign In to Join</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.secondaryLink}>Not now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <View style={styles.errorIconWrap}><Ionicons name="close-circle-outline" size={44} color={colors.error} /></View>
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
      <View style={styles.successIconWrap}><Ionicons name="checkmark-circle-outline" size={56} color={colors.success} /></View>
      <Text style={styles.successTitle}>You're in!</Text>
      <Text style={styles.successSub}>You've joined the session.</Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigation.replace('Session', { sessionId, groupId })}
      >
        <Text style={styles.btnText}>Open Session</Text>
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
  errorIconWrap: { marginBottom: 4 },
  errorTitle: { ...typography.h2, color: colors.text },
  errorMsg: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  successIconWrap: { marginBottom: 4 },
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
  secondaryLink: { fontSize: 14, fontWeight: '600', color: colors.textMuted, padding: 8 },
});
