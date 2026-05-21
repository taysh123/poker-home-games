import axios from 'axios';
import { API_BASE_URL } from './config';

export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  body: string;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationsResponse = {
  notifications: NotificationDto[];
  unreadCount: number;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });

export async function getMyNotifications(token: string): Promise<NotificationsResponse> {
  const { data } = await api.get<NotificationsResponse>('/api/notifications', {
    headers: authHeader(token),
  });
  return data;
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await api.post('/api/notifications/read-all', null, { headers: authHeader(token) });
}
