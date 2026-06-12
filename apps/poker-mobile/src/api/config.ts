import { Platform } from 'react-native';

// Set EXPO_PUBLIC_API_URL in .env (or Vercel env / eas.json build env) to point
// at your backend. Dev fallback: web → localhost, native → local LAN IP.
// PRODUCTION BUILDS MUST SET THE ENV VAR — eas.json preview/production profiles do.
const DEV_FALLBACK = Platform.OS === 'web' ? 'http://localhost:5062' : 'http://10.100.102.5:5062';

if (!process.env.EXPO_PUBLIC_API_URL && !__DEV__) {
  // A release build without the env var ships a dead LAN fallback — make it loud.
  console.warn(
    '[T Poker] EXPO_PUBLIC_API_URL is not set in a release build — backend calls will fail. ' +
    'Set it in eas.json build env (native) or Vercel env (web).',
  );
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? DEV_FALLBACK;
