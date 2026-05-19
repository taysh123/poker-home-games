import axios from 'axios';
import { API_BASE_URL } from './config';
import * as SecureStore from '../utils/storage';

// Registered by AuthContext on mount; called when token refresh fails
let onUnauthenticated: (() => void) | null = null;
export function registerUnauthenticatedCallback(cb: () => void) {
  onUnauthenticated = cb;
}

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

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('no_refresh_token');

        // Use plain axios to avoid triggering the interceptor again
        const { data } = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } },
        );

        await Promise.all([
          SecureStore.setItemAsync('accessToken', data.accessToken),
          SecureStore.setItemAsync('refreshToken', data.refreshToken),
        ]);

        config.headers['Authorization'] = `Bearer ${data.accessToken}`;
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
