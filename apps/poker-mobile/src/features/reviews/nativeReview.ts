/**
 * NATIVE ONLY — every web call is a no-op, mirroring utils/reminders.ts.
 *
 * Returning `false` is a completely normal outcome, not an error. Per the SDK 54 docs
 * (https://docs.expo.dev/versions/v54.0.0/sdk/storereview/) `isAvailableAsync()` resolves false on
 * web and on TestFlight builds, and iOS additionally caps how often the native modal actually
 * appears (~3/year) — a successful `requestReview()` call is NOT a guarantee that the user saw
 * anything. Nothing in the UI may promise that a rating dialog will appear, and no caller should
 * surface `false` as a failure.
 */
import { Platform } from 'react-native';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

function getStoreReview(): typeof import('expo-store-review') | null {
  if (!isNative) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-store-review');
  } catch {
    return null;
  }
}

/** @returns true only if the native review request was actually issued. Never throws or rejects. */
export async function requestNativeReview(): Promise<boolean> {
  const SR = getStoreReview();
  if (!SR) return false;
  try {
    if (!(await SR.isAvailableAsync())) return false;
    await SR.requestReview();
    return true;
  } catch {
    return false;
  }
}
