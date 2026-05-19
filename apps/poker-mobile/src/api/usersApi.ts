import axios from 'axios';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export type UserSearchResultDto = {
  userId: string;
  username: string;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function searchUsers(
  token: string,
  q: string,
): Promise<UserSearchResultDto[]> {
  const { data } = await api.get<UserSearchResultDto[]>(
    `/api/auth/users/search`,
    { params: { q }, headers: authHeader(token) },
  );
  return data;
}
