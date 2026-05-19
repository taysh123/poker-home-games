import apiClient from './apiClient';

export type ActivityLogDto = {
  id: string;
  actorName: string;
  type: string;
  description: string;
  createdAt: string;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getGroupActivity(token: string, groupId: string): Promise<ActivityLogDto[]> {
  const { data } = await apiClient.get<ActivityLogDto[]>(
    `/api/groups/${groupId}/activity`,
    { headers: authHeader(token) },
  );
  return data;
}
