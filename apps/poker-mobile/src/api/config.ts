import { Platform } from 'react-native';

// Web: browser runs on the same machine as the backend — use loopback
// Mobile: Expo Go on a physical device reaches the backend over LAN
//   Run `ipconfig` (Wi-Fi → IPv4 Address) to verify or update the LAN IP below
export const API_BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:5062'
  : 'http://10.100.102.5:5062';
