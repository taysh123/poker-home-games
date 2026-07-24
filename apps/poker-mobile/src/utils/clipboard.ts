import * as Clipboard from 'expo-clipboard';

/**
 * Copy text to the clipboard. `expo-clipboard` handles both native (Keychain/pasteboard) and web
 * (navigator.clipboard), so callers don't branch on Platform. Best-effort — surfaces the rejection
 * so the caller can toast an error.
 */
export async function copyToClipboard(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}
