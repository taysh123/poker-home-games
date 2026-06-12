import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * When a logged-out user opens an invite deep link, we stash the invite here,
 * send them to Login, and complete the join right after they sign in.
 */

const KEY = 'tpoker.pendingInvite';
const TTL_MS = 15 * 60 * 1000;

export type PendingInvite = { type: 'session' | 'group'; token: string; at: number };

export async function savePendingInvite(type: 'session' | 'group', token: string): Promise<void> {
  try {
    const invite: PendingInvite = { type, token, at: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify(invite));
  } catch {
    // non-critical
  }
}

/** Reads AND clears the pending invite. Returns null if missing or older than 15 min. */
export async function consumePendingInvite(): Promise<PendingInvite | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    const invite = JSON.parse(raw) as PendingInvite;
    if (!invite?.token || !invite?.type || Date.now() - invite.at > TTL_MS) return null;
    return invite;
  } catch {
    return null;
  }
}
