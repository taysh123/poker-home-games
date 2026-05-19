import axios from 'axios';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export type BalanceItemDto = {
  itemId: string;
  type: 'Session' | 'Debt';
  amount: number;
  youOwe: boolean;
  description: string;
  sessionId: string | null;
};

export type BalanceEntryDto = {
  userId: string;
  username: string;
  netBalance: number;
  items: BalanceItemDto[];
};

export type DebtDto = {
  id: string;
  groupId: string;
  groupName: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  amount: number;
  reason: string | null;
  status: string;
  createdAt: string;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getMyBalances(token: string): Promise<BalanceEntryDto[]> {
  const { data } = await api.get<BalanceEntryDto[]>('/api/balances', { headers: authHeader(token) });
  return data;
}

export async function createDebt(
  token: string,
  groupId: string,
  fromUserId: string,
  toUserId: string,
  amount: number,
  reason?: string,
): Promise<DebtDto> {
  const { data } = await api.post<DebtDto>(
    `/api/groups/${groupId}/debts`,
    { fromUserId, toUserId, amount, reason: reason || null },
    { headers: authHeader(token) },
  );
  return data;
}

export async function markDebtPaid(token: string, debtId: string): Promise<void> {
  await api.post(`/api/debts/${debtId}/mark-paid`, {}, { headers: authHeader(token) });
}

export async function cancelDebt(token: string, debtId: string): Promise<void> {
  await api.delete(`/api/debts/${debtId}`, { headers: authHeader(token) });
}
