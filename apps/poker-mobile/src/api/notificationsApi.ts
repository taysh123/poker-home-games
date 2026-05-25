import apiClient from './apiClient';

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

export async function getMyNotifications(token: string): Promise<NotificationsResponse> {
  const { data } = await apiClient.get<NotificationsResponse>('/api/notifications', {
    headers: authHeader(token),
  });
  return data;
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await apiClient.post('/api/notifications/read-all', null, { headers: authHeader(token) });
}
