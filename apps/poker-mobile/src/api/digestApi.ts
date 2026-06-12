import apiClient from './apiClient';

export type WeeklyDigestBestNightDto = {
  sessionId: string;
  sessionName: string;
  profitLoss: number;
};

export type WeeklyDigestGroupDto = {
  groupId: string;
  groupName: string;
  gamesCount: number;
};

export type WeeklyDigestDto = {
  sessionsPlayed: number;
  netProfitLoss: number;
  bestNight: WeeklyDigestBestNightDto | null;
  totalMinutesPlayed: number;
  mostActiveGroup: WeeklyDigestGroupDto | null;
  currentStreak: number;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getWeeklyDigest(token: string): Promise<WeeklyDigestDto> {
  const { data } = await apiClient.get<WeeklyDigestDto>(
    '/api/users/me/weekly-digest',
    { headers: authHeader(token) },
  );
  return data;
}
