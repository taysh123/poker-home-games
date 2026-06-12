import axios from 'axios';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export async function registerDeviceToken(
  token: string,
  pushToken: string,
  platform: 'ios' | 'android',
): Promise<void> {
  await api.post(
    '/api/users/device-tokens',
    { token: pushToken, platform },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function unregisterDeviceToken(token: string, pushToken: string): Promise<void> {
  await api.delete('/api/users/device-tokens', {
    headers: { Authorization: `Bearer ${token}` },
    data: { token: pushToken },
  });
}
