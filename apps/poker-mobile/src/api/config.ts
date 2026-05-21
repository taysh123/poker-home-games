import { Platform } from 'react-native';

// Set EXPO_PUBLIC_API_URL in .env (or Vercel/EAS env vars) to point at your backend.
// Dev fallback: web → localhost, native → your local LAN IP (update when it changes).
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'web' ? 'http://localhost:5062' : 'http://10.100.102.5:5062');
