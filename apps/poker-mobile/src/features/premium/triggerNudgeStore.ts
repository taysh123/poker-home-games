/**
 * Persistence seam for the trigger registry's last-shown timestamps (E.1). Thin AsyncStorage
 * wrapper; the frequency-cap logic itself lives in `triggerRegistry.ts` (pure). Fail-safe: any
 * read/parse error resolves to an empty map, so a corrupt payload makes nudges *showable* (never
 * silently suppressed), and a write never throws.
 *
 * Not yet consumed by any screen — the migration that reads/records last-shown is the later visual
 * slice. Kept vendor-neutral and tested (`triggerNudgeStore.test.ts`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isTriggerId, type TriggerId } from './triggers';
import type { NudgeShownState } from './triggerRegistry';

const KEY = 'tpoker.triggerNudge.v1';

export async function loadNudgeShownState(): Promise<NudgeShownState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: NudgeShownState = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isTriggerId(k) && typeof v === 'number' && Number.isFinite(v)) {
        out[k as TriggerId] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function saveNudgeShownState(state: NudgeShownState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // best-effort — a nudge bookkeeping write must never surface an error to the user
  }
}
