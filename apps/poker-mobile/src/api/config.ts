import { Platform } from 'react-native';

// EXPO_PUBLIC_API_URL is set in .env for production deployments.
// In dev: falls back to localhost (web) or LAN IP (mobile).
//   Update the LAN IP below when your local IP changes.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'web' ? 'http://localhost:5062' : 'http://10.100.102.5:5062');
