/**
 * Persistence for the single "next game plan" (slice 2.4). Thin AsyncStorage wrapper; fail-safe — a
 * corrupt/invalid payload loads as `null` (the card/notification simply don't show), and writes never
 * throw. The plan model + queries live in `logic/nextGamePlan.ts`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NextGamePlan, GameMode } from '../logic/nextGamePlan';

const KEY = 'tpoker.nextGamePlan.v1';

export async function loadNextGamePlan(): Promise<NextGamePlan | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const p: unknown = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    const rec = p as Record<string, unknown>;
    if ((rec.mode !== 'cash' && rec.mode !== 'tournament') || !Array.isArray(rec.crew) || typeof rec.createdDayKey !== 'string') {
      return null;
    }
    return {
      mode: rec.mode as GameMode,
      crew: (rec.crew as unknown[]).filter((n): n is string => typeof n === 'string'),
      gameDay: typeof rec.gameDay === 'string' ? rec.gameDay : undefined,
      createdDayKey: rec.createdDayKey,
      origin: rec.origin === 'local' || rec.origin === 'server' ? rec.origin : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveNextGamePlan(plan: NextGamePlan): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(plan));
  } catch {
    // best-effort — a plan write must never surface an error
  }
}

export async function clearNextGamePlan(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}
