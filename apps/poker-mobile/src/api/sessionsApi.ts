import apiClient from './apiClient';

const api = apiClient;

export type SessionSummaryDto = {
  id: string;
  name: string;
  status: string;
  playerCount: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  myProfitLoss?: number | null;
};

export type SessionPlayerDto = {
  sessionPlayerId: string;
  userId?: string;
  username: string;
  isGuest: boolean;
  linkedUserId?: string;
};

export type SessionDetailDto = {
  id: string;
  name: string;
  groupId: string;
  status: string;
  chipRatio?: number;
  defaultBuyIn?: number;
  players: SessionPlayerDto[];
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  notes: string | null;
};

export type CreateSessionResponse = {
  id: string;
  name: string;
  groupId: string;
  status: string;
  chipRatio?: number;
  defaultBuyIn?: number;
  createdAt: string;
};

export type AddPlayerResponse = {
  sessionPlayerId: string;
  sessionId: string;
  userId?: string;
  guestName?: string;
  isGuest: boolean;
  linkedUserId?: string;
};

export type AddTransactionResponse = {
  id: string;
  sessionId: string;
  sessionPlayerId: string;
  amount: number;
  timestamp: string;
};

export type PlayerBalanceDto = {
  sessionPlayerId: string;
  username: string;
  isGuest: boolean;
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

export type FinalStackItem = {
  sessionPlayerId: string;
  amount: number;
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
  chipRatio?: number,
  defaultBuyIn?: number,
): Promise<CreateSessionResponse> {
  const { data } = await api.post<CreateSessionResponse>(
    `/api/groups/${groupId}/sessions`,
    { name, chipRatio, defaultBuyIn },
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

export async function endSession(
  token: string,
  sessionId: string,
  finalStacks?: FinalStackItem[],
): Promise<void> {
  await api.post(
    `/api/sessions/${sessionId}/end`,
    finalStacks && finalStacks.length > 0 ? { finalStacks } : {},
    { headers: authHeader(token) },
  );
}

export async function addPlayer(
  token: string,
  sessionId: string,
  userId?: string,
  guestName?: string,
  linkedUserId?: string,
): Promise<AddPlayerResponse> {
  const { data } = await api.post<AddPlayerResponse>(
    `/api/sessions/${sessionId}/players`,
    { userId, guestName, linkedUserId },
    { headers: authHeader(token) },
  );
  return data;
}

export async function removePlayer(
  token: string,
  sessionId: string,
  sessionPlayerId: string,
): Promise<void> {
  await api.delete(`/api/sessions/${sessionId}/players/${sessionPlayerId}`, {
    headers: authHeader(token),
  });
}

export async function addBuyIn(
  token: string,
  sessionId: string,
  sessionPlayerId: string,
  amount: number,
): Promise<AddTransactionResponse> {
  const { data } = await api.post<AddTransactionResponse>(
    `/api/sessions/${sessionId}/buyins`,
    { sessionPlayerId, amount },
    { headers: authHeader(token) },
  );
  return data;
}

export async function addCashOut(
  token: string,
  sessionId: string,
  sessionPlayerId: string,
  amount: number,
): Promise<AddTransactionResponse> {
  const { data } = await api.post<AddTransactionResponse>(
    `/api/sessions/${sessionId}/cashouts`,
    { sessionPlayerId, amount },
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
