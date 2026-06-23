import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { STARTER_DATASET } from '../../study/data/starterRanges';
import type { PreflopRange } from '../../study/types';
import { loadPacks } from '../data/solverPackStore';
import { addSavedSpot, loadSavedSpots, removeSavedSpot, type SavedSpot } from '../data/savedSpotsStore';
import type { SolverPack } from '../pack/types';

/**
 * Solver workspace state: imported canonical packs + the bundled ILLUSTRATIVE study ranges (labelled) as a
 * fallback source, plus private saved spots. Fail-soft: load errors degrade to empty, never crash the screen.
 */
interface SolverContextType {
  packs: SolverPack[];
  illustrativeRanges: PreflopRange[];
  savedSpots: SavedSpot[];
  isLoaded: boolean;
  saveSpot: (spot: Omit<SavedSpot, 'id' | 'createdAt'>) => Promise<void>;
  unsaveSpot: (id: string) => Promise<void>;
}

const SolverContext = createContext<SolverContextType>({
  packs: [],
  illustrativeRanges: [],
  savedSpots: [],
  isLoaded: false,
  saveSpot: async () => {},
  unsaveSpot: async () => {},
});

export function SolverProvider({ children }: { children: React.ReactNode }) {
  const [packs, setPacks] = useState<SolverPack[]>([]);
  const [savedSpots, setSavedSpots] = useState<SavedSpot[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPacks().catch(() => []), loadSavedSpots().catch(() => [])]).then(([p, s]) => {
      if (cancelled) return;
      setPacks(p);
      setSavedSpots(s);
      setIsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSpot = useCallback(async (spot: Omit<SavedSpot, 'id' | 'createdAt'>) => {
    setSavedSpots(await addSavedSpot(spot));
  }, []);
  const unsaveSpot = useCallback(async (id: string) => {
    setSavedSpots(await removeSavedSpot(id));
  }, []);

  return (
    <SolverContext.Provider
      value={{ packs, illustrativeRanges: STARTER_DATASET.ranges, savedSpots, isLoaded, saveSpot, unsaveSpot }}
    >
      {children}
    </SolverContext.Provider>
  );
}

export function useSolver(): SolverContextType {
  return useContext(SolverContext);
}
