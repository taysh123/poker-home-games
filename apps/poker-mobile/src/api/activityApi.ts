import apiClient from './apiClient';

export type ActivityLogDto = {
  id: string;
  actorName: string;
  type: string;
  description: string;
  createdAt: string;
  relatedSessionId?: string | null;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getGroupActivity(
  token: string,
  groupId: string,
  params?: { skip?: number; take?: number },
): Promise<ActivityLogDto[]> {
  const { data } = await apiClient.get<ActivityLogDto[]>(
    `/api/groups/${groupId}/activity`,
    { headers: authHeader(token), params },
  );
  return data;
}
