import apiClient from './apiClient';

export type AchievementDto = {
  key: string;
  name: string;
  description: string;
  iconKey: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  unlockedAt: string | null;
};

export type MyAchievementsDto = {
  earned: AchievementDto[];
  locked: AchievementDto[];
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getMyAchievements(token: string): Promise<MyAchievementsDto> {
  const { data } = await apiClient.get<MyAchievementsDto>('/api/users/me/achievements', {
    headers: authHeader(token),
  });
  return data;
}
