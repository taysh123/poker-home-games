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

export type ProfileSessionDto = {
  sessionId: string;
  sessionName: string;
  groupId: string | null;
  groupName: string;
  profitLoss: number;
  date: string;
};

export type PlayerProfileDto = {
  userId: string;
  username: string;
  totalSessionsPlayed: number;
  totalProfitLoss: number;
  biggestWin: number | null;
  biggestLoss: number | null;
  winsCount: number;
  lossesCount: number;
  breakEvenCount: number;
  averageProfitLoss: number;
  winRate: number;
  currentStreak: number;
  longestWinStreak: number;
  recentForm: string[];
  recentSessions: ProfileSessionDto[];
};

export type H2HMatchupDto = {
  sessionId: string;
  sessionName: string;
  groupName: string;
  myProfitLoss: number;
  opponentProfitLoss: number;
  date: string;
};

export type HeadToHeadDto = {
  opponentId: string;
  opponentUsername: string;
  sessionsTogether: number;
  myWins: number;
  opponentWins: number;
  ties: number;
  myProfitVsOpponent: number;
  lastPlayedTogether: string | null;
  recentMatchups: H2HMatchupDto[];
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

export async function getPlayerProfile(
  token: string,
  userId: string,
): Promise<PlayerProfileDto> {
  const { data } = await api.get<PlayerProfileDto>(
    `/api/users/${userId}/profile`,
    { headers: authHeader(token) },
  );
  return data;
}

export async function getHeadToHead(
  token: string,
  opponentId: string,
): Promise<HeadToHeadDto> {
  const { data } = await api.get<HeadToHeadDto>(
    `/api/users/${opponentId}/head-to-head`,
    { headers: authHeader(token) },
  );
  return data;
}
