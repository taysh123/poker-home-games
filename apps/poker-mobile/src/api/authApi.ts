import apiClient from './apiClient';

const api = apiClient;

export type AuthUser = {
  userId: string;
  username: string;
  email: string;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
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

// Apple Sign In (server validates the identity token). Client button is wired later
// (needs expo-apple-authentication + an iOS dev build); this plumbing is ready now.
export async function appleLoginApi(identityToken: string, nonce?: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/apple', { identityToken, nonce });
  return data;
}

export async function logoutApi(accessToken: string, refreshToken: string): Promise<void> {
  await api.post(
    '/api/auth/logout',
    { refreshToken },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}
