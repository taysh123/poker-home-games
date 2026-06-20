/**
 * Content bootstrap (PR #2) — flag-gated entry point. **No-op when the `content` flag is OFF** (returns
 * a disabled result; nothing is created), so production is byte-identical. When ON, it creates a
 * ContentStore over the platform backend (native = expo-sqlite via lazy import so it never loads on web;
 * web/test = in-memory). It does NOT ingest any packs yet — the published set (D2) isn't wired in until a
 * later consumer PR. NOT mounted in App.tsx in PR #2.
 */
import { Platform } from 'react-native';
import { isFeatureEnabled } from '../config/features';
import { createContentStore, type ContentStore } from './contentStore';
import { createMemoryBackend } from './memoryBackend';
import type { ContentBackend } from './backend';

export interface BootstrapResult { enabled: boolean; store: ContentStore | null }

export async function bootstrapContent(): Promise<BootstrapResult> {
  if (!isFeatureEnabled('content')) return { enabled: false, store: null };
  let backend: ContentBackend;
  if (Platform.OS === 'web') {
    backend = createMemoryBackend(); // OD-1: in-memory JSON backend on web
  } else {
    const { createSqliteBackend } = await import('./sqliteBackend'); // lazy → never loaded on web/when OFF
    backend = await createSqliteBackend();
  }
  const store = createContentStore(backend);
  // D2 pending: no bundled packs to ingest yet. Store is ready (empty).
  return { enabled: true, store };
}
