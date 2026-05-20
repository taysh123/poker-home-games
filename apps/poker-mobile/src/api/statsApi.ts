import apiClient from './apiClient';

const api = apiClient;

export type RecentSessionDto = {
  sessionId: string;
  sessionName: string;
  groupId: string | null;
  groupName: string;
  userRole: string;
  status: string;
  profitLoss: number | null;
  createdAt: string;
};

export type MyStatsDto = {
  totalSessionsPlayed: number;
  totalProfitLoss: number;
  biggestWin: number | null;
  biggestLoss: number | null;
  winsCount: number;
  lossesCount: number;
  breakEvenCount: number;
  averageProfitLoss: number;
  recentSessions: RecentSessionDto[];
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getMyStats(token: string): Promise<MyStatsDto> {
  const { data } = await api.get<MyStatsDto>('/api/auth/stats', {
    headers: authHeader(token),
  });
  return data;
}
