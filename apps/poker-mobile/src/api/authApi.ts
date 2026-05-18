import axios from 'axios';

// Android emulator → http://10.0.2.2:5062
// iOS simulator   → http://localhost:5062
// Physical device → http://<your-machine-LAN-IP>:5062
const BASE_URL = 'http://10.100.102.5:5062';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export type AuthUser = {
  userId: string;
  username: string;
  email: string;
};

export type AuthResponse = AuthUser & {
  accessToken: string;
  refreshToken: string;
};

export async function loginApi(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/login', { email, password });
  return data;
}

export async function registerApi(
  username: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/register', {
    username,
    email,
    password,
  });
  return data;
}

export async function googleLoginApi(idToken: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/google', { idToken });
  return data;
}

export async function logoutApi(accessToken: string, refreshToken: string): Promise<void> {
  await api.post(
    '/api/auth/logout',
    { refreshToken },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}
