import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * When a logged-out visitor taps a pricing CTA, we stash the chosen plan here,
 * send them to sign-up, and resume checkout right after they authenticate.
 * Mirrors utils/pendingInvite.ts (TTL + single-use + fail-closed).
 */

const KEY = 'tpoker.pendingCheckout';
const TTL_MS = 15 * 60 * 1000;

export type CheckoutPlan = 'monthly' | 'yearly';
type Stashed = { plan: CheckoutPlan; at: number };

export async function savePendingCheckout(plan: CheckoutPlan): Promise<void> {
  try {
    const payload: Stashed = { plan, at: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // non-critical
  }
}

/** Reads AND clears the pending checkout. Null if missing, expired, or invalid. */
export async function consumePendingCheckout(): Promise<CheckoutPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    const data = JSON.parse(raw) as Stashed;
    const planOk = data?.plan === 'monthly' || data?.plan === 'yearly';
    if (!planOk || typeof data.at !== 'number' || Date.now() - data.at > TTL_MS) return null;
    return data.plan;
  } catch {
    return null;
  }
}
