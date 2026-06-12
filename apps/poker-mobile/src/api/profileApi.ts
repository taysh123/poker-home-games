import apiClient from './apiClient';

export type UpdateProfileResponse = {
  userId: string;
  username: string;
  email: string;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
};

export type IdentityUpdate = {
  username?: string;
  email?: string;
  /** Empty string clears the emoji; undefined leaves it unchanged. */
  avatarEmoji?: string;
  /** Empty string clears the color; undefined leaves it unchanged. */
  avatarColor?: string;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function updateProfile(
  token: string,
  username?: string,
  email?: string,
  identity?: Pick<IdentityUpdate, 'avatarEmoji' | 'avatarColor'>,
): Promise<UpdateProfileResponse> {
  const { data } = await apiClient.put<UpdateProfileResponse>(
    '/api/auth/profile',
    {
      username: username ?? null,
      email: email ?? null,
      avatarEmoji: identity?.avatarEmoji ?? null,
      avatarColor: identity?.avatarColor ?? null,
    },
    { headers: authHeader(token) },
  );
  return data;
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiClient.put(
    '/api/auth/password',
    { currentPassword, newPassword },
    { headers: authHeader(token) },
  );
}

export async function deleteAccount(token: string): Promise<void> {
  await apiClient.delete('/api/auth/account', { headers: authHeader(token) });
}
