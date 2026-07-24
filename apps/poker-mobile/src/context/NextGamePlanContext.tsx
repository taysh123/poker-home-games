import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { NextGamePlan } from '../features/engagement/logic/nextGamePlan';
import { isPlanStale } from '../features/engagement/logic/nextGamePlan';
import { loadNextGamePlan, saveNextGamePlan, clearNextGamePlan } from '../features/engagement/data/nextGamePlanStore';
import { localDayKey } from '../features/study/logic/localDay';

/**
 * The single on-device "next game plan" (slice 2.4), shared by guests and signed-in users. Loads on
 * mount and auto-clears a stale (past-dated) plan. The "Same crew next week?" end-of-game action calls
 * `setNextGame`; the Home/GuestHome "Next game" card + the game-day notification read `plan`.
 */
interface NextGamePlanValue {
  plan: NextGamePlan | null;
  setNextGame: (plan: NextGamePlan) => Promise<void>;
  clearNextGame: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<NextGamePlanValue | undefined>(undefined);

export function NextGamePlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<NextGamePlan | null>(null);

  const refresh = useCallback(async () => {
    const loaded = await loadNextGamePlan();
    if (loaded && isPlanStale(loaded, localDayKey())) {
      await clearNextGamePlan();
      setPlan(null);
      return;
    }
    setPlan(loaded);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const setNextGame = useCallback(async (next: NextGamePlan) => {
    await saveNextGamePlan(next);
    setPlan(next);
  }, []);

  const clearNextGame = useCallback(async () => {
    await clearNextGamePlan();
    setPlan(null);
  }, []);

  return (
    <Ctx.Provider value={{ plan, setNextGame, clearNextGame, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNextGamePlan(): NextGamePlanValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNextGamePlan must be used within NextGamePlanProvider');
  return ctx;
}
