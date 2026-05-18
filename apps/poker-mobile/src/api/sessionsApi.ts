import axios from 'axios';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export type SessionSummaryDto = {
  id: string;
  name: string;
  status: string;
  playerCount: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export type SessionPlayerDto = {
  userId: string;
  username: string;
};

export type SessionDetailDto = {
  id: string;
  name: string;
  groupId: string;
  status: string;
  smallBlind: number;
  bigBlind: number;
  chipRatio?: number;
  defaultBuyIn?: number;
  players: SessionPlayerDto[];
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export type CreateSessionResponse = {
  id: string;
  name: string;
  groupId: string;
  status: string;
  smallBlind: number;
  bigBlind: number;
  chipRatio?: number;
  defaultBuyIn?: number;
  createdAt: string;
};

export type AddPlayerResponse = {
  sessionPlayerId: string;
  sessionId: string;
  userId: string;
};

export type AddTransactionResponse = {
  id: string;
  sessionId: string;
  userId: string;
  amount: number;
  timestamp: string;
};

export type PlayerBalanceDto = {
  userId: string;
  username: string;
  totalBuyIn: number;
  totalCashOut: number;
  profitLoss: number;
};

export type SessionBalancesDto = {
  sessionId: string;
  sessionName: string;
  status: string;
  totalPot: number;
  players: PlayerBalanceDto[];
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getGroupSessions(
  token: string,
  groupId: string,
): Promise<SessionSummaryDto[]> {
  const { data } = await api.get<SessionSummaryDto[]>(
    `/api/groups/${groupId}/sessions`,
    { headers: authHeader(token) },
  );
  return data;
}

export async function createSession(
  token: string,
  groupId: string,
  name: string,
  smallBlind: number,
  bigBlind: number,
  chipRatio?: number,
  defaultBuyIn?: number,
): Promise<CreateSessionResponse> {
  const { data } = await api.post<CreateSessionResponse>(
    `/api/groups/${groupId}/sessions`,
    { name, smallBlind, bigBlind, chipRatio, defaultBuyIn },
    { headers: authHeader(token) },
  );
  return data;
}

export async function getSessionById(
  token: string,
  sessionId: string,
): Promise<SessionDetailDto> {
  const { data } = await api.get<SessionDetailDto>(
    `/api/sessions/${sessionId}`,
    { headers: authHeader(token) },
  );
  return data;
}

export async function startSession(token: string, sessionId: string): Promise<void> {
  await api.post(`/api/sessions/${sessionId}/start`, {}, { headers: authHeader(token) });
}

export async function endSession(token: string, sessionId: string): Promise<void> {
  await api.post(`/api/sessions/${sessionId}/end`, {}, { headers: authHeader(token) });
}

export async function addPlayer(
  token: string,
  sessionId: string,
  userId: string,
): Promise<AddPlayerResponse> {
  const { data } = await api.post<AddPlayerResponse>(
    `/api/sessions/${sessionId}/players`,
    { userId },
    { headers: authHeader(token) },
  );
  return data;
}

export async function removePlayer(
  token: string,
  sessionId: string,
  userId: string,
): Promise<void> {
  await api.delete(`/api/sessions/${sessionId}/players/${userId}`, {
    headers: authHeader(token),
  });
}

export async function addBuyIn(
  token: string,
  sessionId: string,
  userId: string,
  amount: number,
): Promise<AddTransactionResponse> {
  const { data } = await api.post<AddTransactionResponse>(
    `/api/sessions/${sessionId}/buyins`,
    { userId, amount },
    { headers: authHeader(token) },
  );
  return data;
}

export async function addCashOut(
  token: string,
  sessionId: string,
  userId: string,
  amount: number,
): Promise<AddTransactionResponse> {
  const { data } = await api.post<AddTransactionResponse>(
    `/api/sessions/${sessionId}/cashouts`,
    { userId, amount },
    { headers: authHeader(token) },
  );
  return data;
}

export async function getSessionBalances(
  token: string,
  sessionId: string,
): Promise<SessionBalancesDto> {
  const { data } = await api.get<SessionBalancesDto>(
    `/api/sessions/${sessionId}/balances`,
    { headers: authHeader(token) },
  );
  return data;
}
