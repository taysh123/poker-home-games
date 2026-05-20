import apiClient from './apiClient';

const api = apiClient;

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

export type PendingInvitationDto = {
  invitationId: string;
  groupId: string;
  groupName: string;
  invitedByUsername: string;
  expiresAt: string;
  createdAt: string;
};

export type AcceptInvitationResponse = {
  groupId: string;
  groupName: string;
  role: string;
};

export type UpdateGroupResponse = {
  id: string;
  name: string;
  description?: string;
};

export async function getMyInvitations(token: string): Promise<PendingInvitationDto[]> {
  const { data } = await api.get<PendingInvitationDto[]>('/api/invitations', {
    headers: authHeader(token),
  });
  return data;
}

export async function sendGroupInvitation(
  token: string,
  groupId: string,
  username: string,
): Promise<void> {
  await api.post(
    `/api/groups/${groupId}/invitations`,
    { username },
    { headers: authHeader(token) },
  );
}

export async function acceptInvitation(
  token: string,
  invitationId: string,
): Promise<AcceptInvitationResponse> {
  const { data } = await api.post<AcceptInvitationResponse>(
    `/api/invitations/${invitationId}/accept`,
    {},
    { headers: authHeader(token) },
  );
  return data;
}

export async function declineInvitation(token: string, invitationId: string): Promise<void> {
  await api.post(
    `/api/invitations/${invitationId}/decline`,
    {},
    { headers: authHeader(token) },
  );
}

export async function removeGroupMember(
  token: string,
  groupId: string,
  userId: string,
): Promise<void> {
  await api.delete(`/api/groups/${groupId}/members/${userId}`, {
    headers: authHeader(token),
  });
}

export async function leaveGroup(token: string, groupId: string): Promise<void> {
  await api.delete(`/api/groups/${groupId}/members/me`, {
    headers: authHeader(token),
  });
}

export async function deleteGroup(token: string, groupId: string): Promise<void> {
  await api.delete(`/api/groups/${groupId}`, { headers: authHeader(token) });
}

export async function updateGroup(
  token: string,
  groupId: string,
  name: string,
  description?: string,
): Promise<UpdateGroupResponse> {
  const { data } = await api.put<UpdateGroupResponse>(
    `/api/groups/${groupId}`,
    { name, description },
    { headers: authHeader(token) },
  );
  return data;
}

export type PlayerLeaderboardEntryDto = {
  userId: string;
  username: string;
  sessionsPlayed: number;
  totalProfitLoss: number;
  biggestWin: number | null;
  biggestLoss: number | null;
  winsCount: number;
  avgProfitLoss: number;
};

export type GroupInviteLinkResponse = {
  token: string;
  deepLinkUrl: string;
  expiresAt: string;
};

export type JoinGroupByLinkResponse = {
  groupId: string;
  groupName: string;
  role: string;
};

export async function generateGroupInviteLink(
  token: string,
  groupId: string,
): Promise<GroupInviteLinkResponse> {
  const { data } = await api.post<GroupInviteLinkResponse>(
    `/api/groups/${groupId}/invite-link`,
    {},
    { headers: authHeader(token) },
  );
  return data;
}

export async function joinGroupByInviteLink(
  token: string,
  inviteToken: string,
): Promise<JoinGroupByLinkResponse> {
  const { data } = await api.post<JoinGroupByLinkResponse>(
    `/api/groups/join/${inviteToken}`,
    {},
    { headers: authHeader(token) },
  );
  return data;
}

export async function getGroupLeaderboard(
  token: string,
  groupId: string,
): Promise<PlayerLeaderboardEntryDto[]> {
  const { data } = await api.get<PlayerLeaderboardEntryDto[]>(
    `/api/groups/${groupId}/leaderboard`,
    { headers: authHeader(token) },
  );
  return data;
}
