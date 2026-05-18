import axios from 'axios';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export type SettlementDto = {
  id: string;
  payerUserId: string;
  payerName: string;
  receiverUserId: string;
  receiverName: string;
  amount: number;
  status: string; // 'Pending' | 'Confirmed'
};

export type SessionSettlementsDto = {
  sessionId: string;
  totalPot: number;
  settlements: SettlementDto[];
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function calculateSettlements(
  token: string,
  sessionId: string,
): Promise<SettlementDto[]> {
  const { data } = await api.post<SettlementDto[]>(
    `/api/sessions/${sessionId}/settlements/calculate`,
    {},
    { headers: authHeader(token) },
  );
  return data;
}

export async function getSessionSettlements(
  token: string,
  sessionId: string,
): Promise<SessionSettlementsDto> {
  const { data } = await api.get<SessionSettlementsDto>(
    `/api/sessions/${sessionId}/settlements`,
    { headers: authHeader(token) },
  );
  return data;
}

export async function markSettlementPaid(
  token: string,
  settlementId: string,
): Promise<void> {
  await api.post(
    `/api/settlements/${settlementId}/mark-paid`,
    {},
    { headers: authHeader(token) },
  );
}
