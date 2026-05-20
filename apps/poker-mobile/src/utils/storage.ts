import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

let _sessionMode = false;
export function setSessionMode(on: boolean) { _sessionMode = on; }

export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    (_sessionMode ? sessionStorage : localStorage).setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
