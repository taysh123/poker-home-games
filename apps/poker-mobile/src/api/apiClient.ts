import axios from 'axios';
import { API_BASE_URL } from './config';
import * as SecureStore from '../utils/storage';

// Registered by AuthContext on mount; called when token refresh fails
let onUnauthenticated: (() => void) | null = null;
export function registerUnauthenticatedCallback(cb: () => void) {
  onUnauthenticated = cb;
}

// Refresh mutex — only one token refresh runs at a time.
// Concurrent 401s all await the same promise so only one /api/auth/refresh
// call hits the server (backend uses refresh token rotation: reusing a consumed
// token returns 400, which was causing cascading auth failures).
let refreshPromise: Promise<string> | null = null;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

apiClient.interceptors.response.use(
  response => response,
  async (error) => {
    const config = error.config as any;

    if (error.response?.status === 401 && !config?._retry) {
      config._retry = true;

      // Start a refresh only if one isn't already in-flight
      if (!refreshPromise) {
        refreshPromise = (async () => {
          const refreshToken = await SecureStore.getItemAsync('refreshToken');
          if (!refreshToken) throw new Error('no_refresh_token');

          // Plain axios — must not go through the interceptor again
          const { data } = await axios.post(
            `${API_BASE_URL}/api/auth/refresh`,
            { refreshToken },
            { headers: { 'Content-Type': 'application/json' } },
          );

          await Promise.all([
            SecureStore.setItemAsync('accessToken', data.accessToken),
            SecureStore.setItemAsync('refreshToken', data.refreshToken),
          ]);

          return data.accessToken as string;
        })().finally(() => {
          refreshPromise = null;
        });
      }

      try {
        const newAccessToken = await refreshPromise;
        config.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return apiClient(config);
      } catch {
        onUnauthenticated?.();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
