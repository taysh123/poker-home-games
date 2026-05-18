import axios from 'axios';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export type MyGroupDto = {
  id: string;
  name: string;
  description?: string;
  role: string;
  memberCount: number;
  createdAt: string;
};

export type CreateGroupResponse = {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string;
};

export type GroupDetailResponse = {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  memberCount: number;
  myRole: string;
  createdAt: string;
};

export type GroupMemberDto = {
  userId: string;
  username: string;
  email: string;
  role: string;
  joinedAt: string;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getMyGroups(token: string): Promise<MyGroupDto[]> {
  const { data } = await api.get<MyGroupDto[]>('/api/groups', {
    headers: authHeader(token),
  });
  return data;
}

export async function createGroup(
  token: string,
  name: string,
  description?: string,
): Promise<CreateGroupResponse> {
  const { data } = await api.post<CreateGroupResponse>(
    '/api/groups',
    { name, description },
    { headers: authHeader(token) },
  );
  return data;
}

export async function getGroupById(token: string, groupId: string): Promise<GroupDetailResponse> {
  const { data } = await api.get<GroupDetailResponse>(`/api/groups/${groupId}`, {
    headers: authHeader(token),
  });
  return data;
}

export async function getGroupMembers(
  token: string,
  groupId: string,
): Promise<GroupMemberDto[]> {
  const { data } = await api.get<GroupMemberDto[]>(`/api/groups/${groupId}/members`, {
    headers: authHeader(token),
  });
  return data;
}
