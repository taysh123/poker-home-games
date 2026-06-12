import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import SkeletonCard from '../components/SkeletonCard';
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
      <Screen style={styles.center}>
        <SkeletonCard height={120} borderRadius={16} style={styles.joinSkeleton} />
        <Text style={styles.joiningText}>Joining session…</Text>
      </Screen>
    );
  }

  if (status === 'signin') {
    return (
      <Screen style={styles.center}>
        <View style={styles.successIconWrap}><Ionicons name="mail-open-outline" size={48} color={colors.gold} /></View>
        <Text style={styles.errorTitle}>You're invited!</Text>
        <Text style={styles.errorMsg}>Sign in to join this game — we'll take you straight back here.</Text>
        <PrimaryButton
          label="Sign In to Join"
          variant="gradient"
          fullWidth={false}
          style={styles.btn}
          onPress={async () => {
            await savePendingInvite('session', inviteToken);
            navigation.navigate('Login');
          }}
        />
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.secondaryLink}>Not now</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen style={styles.center}>
        <View style={styles.errorIconWrap}><Ionicons name="close-circle-outline" size={44} color={colors.error} /></View>
        <Text style={styles.errorTitle}>Couldn't join</Text>
        <Text style={styles.errorMsg}>{errorMsg}</Text>
        <PrimaryButton label="Go Back" variant="outline" fullWidth={false} style={styles.btn} onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.center}>
      <View style={styles.successIconWrap}><Ionicons name="checkmark-circle-outline" size={56} color={colors.success} /></View>
      <Text style={styles.successTitle}>You're in!</Text>
      <Text style={styles.successSub}>You've joined the session.</Text>
      <PrimaryButton
        label="Open Session"
        variant="gradient"
        fullWidth={false}
        style={styles.btn}
        onPress={() => navigation.replace('Session', { sessionId, groupId })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  joinSkeleton: { width: 220 },
  joiningText: { ...typography.body, color: colors.textMuted, marginTop: 8 },
  errorIconWrap: { marginBottom: 4 },
  errorTitle: { ...typography.h2, color: colors.text },
  errorMsg: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  successIconWrap: { marginBottom: 4 },
  successTitle: { ...typography.h1, color: colors.text },
  successSub: { fontSize: 15, color: colors.textMuted },
  btn: { marginTop: 8, minWidth: 200 },
  secondaryLink: { fontSize: 14, fontWeight: '600', color: colors.textMuted, padding: 8 },
});
