import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../api/config';
import * as SecureStore from './storage';

export async function exportSessionCsv(sessionId: string, sessionName: string): Promise<void> {
  const token = await SecureStore.getItemAsync('accessToken');
  if (!token) throw new Error('Not authenticated');

  const url = `${API_BASE_URL}/api/sessions/${sessionId}/export`;
  const fileName = `session-${sessionName.replace(/\s+/g, '-')}.csv`;
  const destFile = new File(Paths.cache, fileName);

  const downloaded = await File.downloadFileAsync(url, destFile, {
    headers: { Authorization: `Bearer ${token}` },
    idempotent: true,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');

  await Sharing.shareAsync(downloaded.uri, {
    mimeType: 'text/csv',
    dialogTitle: `Export: ${sessionName}`,
    UTI: 'public.comma-separated-values-text',
  });
}
