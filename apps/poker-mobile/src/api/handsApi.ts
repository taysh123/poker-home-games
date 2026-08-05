import apiClient from './apiClient';

const api = apiClient;

export type HandRecordDto = {
  id: string;
  winnerName: string;
  potAmount: number;
  note: string | null;
  /**
   * Whether the signed-in user logged this hand — the server's answer, not an id to compare.
   * Replaces `createdByUserId`, which shipped the raw account GUID of whoever logged the hand to
   * every session participant (audit 2026-08-03, HIGH #4). The server computes this from the same
   * rule it enforces on delete, so the button can no longer disagree with the endpoint.
   */
  isMine: boolean;
  createdAt: string;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getSessionHandHistory(token: string, sessionId: string): Promise<HandRecordDto[]> {
  const { data } = await api.get<HandRecordDto[]>(`/api/sessions/${sessionId}/hands`, {
    headers: authHeader(token),
  });
  return data;
}

export async function addHandRecord(
  token: string,
  sessionId: string,
  winnerName: string,
  potAmount: number,
  note?: string,
): Promise<HandRecordDto> {
  const { data } = await api.post<HandRecordDto>(
    `/api/sessions/${sessionId}/hands`,
    { winnerName, potAmount, note: note || null },
    { headers: authHeader(token) },
  );
  return data;
}

export async function deleteHandRecord(token: string, sessionId: string, handId: string): Promise<void> {
  await api.delete(`/api/sessions/${sessionId}/hands/${handId}`, { headers: authHeader(token) });
}

export async function updateSessionNotes(token: string, sessionId: string, notes: string | null): Promise<void> {
  await api.patch(`/api/sessions/${sessionId}/notes`, { notes }, { headers: authHeader(token) });
}
