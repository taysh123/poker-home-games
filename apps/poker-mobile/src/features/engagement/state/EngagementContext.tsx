import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isFeatureEnabled } from '../../../config/features';
import { useStudy } from '../../study/state/StudyContext';
import { useBankroll } from '../../bankroll/state/BankrollContext';
import { useCoach } from '../../coach/state/CoachContext';
import { useLocalGames } from '../../../context/LocalGamesContext';
import { sessionNetCents } from '../../bankroll/logic/bankrollAnalytics';
import { computeXp, rankForXp, type RankInfo } from '../logic/xp';
import { LOCAL_ACHIEVEMENTS, evaluate, eligibleKeys, findAchievement } from '../logic/achievements';
import * as store from '../data/engagementStore';
import AchievementUnlock from '../../../components/AchievementUnlock';
import Celebration from '../../../components/motion/Celebration';
import type { EngagementSignals, EngagementState } from '../types';
import type { AchievementDto } from '../../../api/achievementsApi';

export interface LocalAchievementView {
  key: string;
  name: string;
  description: string;
  iconKey: string;
  rarity: string;
  earned: boolean;
  unlockedAt: string | null;
}

type EngagementContextType = {
  enabled: boolean;
  isLoaded: boolean;
  xpTotal: number;
  rank: RankInfo;
  signals: EngagementSignals;
  localAchievements: LocalAchievementView[];
};

const EngagementContext = createContext<EngagementContextType | null>(null);

function toDto(key: string, iso: string): AchievementDto {
  const a = findAchievement(key)!;
  return { key, name: a.name, description: a.desc, iconKey: a.ionicon, rarity: a.rarity, unlockedAt: iso };
}

export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const enabled = isFeatureEnabled('retention');
  const { progress, isLoaded: studyLoaded } = useStudy();
  const { sessions, isLoaded: bankrollLoaded } = useBankroll();
  const { history, isLoaded: coachLoaded } = useCoach();
  const { games } = useLocalGames();

  const [state, setState] = useState<EngagementState>(store.emptyState());
  const [stateLoaded, setStateLoaded] = useState(false);
  const [unlockQueue, setUnlockQueue] = useState<AchievementDto[]>([]);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    store.loadState().then(s => { if (!cancelled) { setState(s); setStateLoaded(true); } });
    return () => { cancelled = true; };
  }, []);

  // ── Derive signals from the local pillars ──
  const spotsAnswered = progress.totalAnswered;
  const studyStreak = progress.currentStreak;
  const bankrollSessions = sessions.length;
  const coachAnalyses = history.length;
  const localGamesFinished = useMemo(() => games.filter(g => g.status === 'Finished').length, [games]);
  const bankrollPositiveMonth = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    const net = sessions.filter(s => s.startedAt.slice(0, 7) === month).reduce((sum, s) => sum + sessionNetCents(s), 0);
    return net > 0;
  }, [sessions]);

  const signals: EngagementSignals = useMemo(() => ({
    spotsAnswered, studyStreak, bankrollSessions, bankrollPositiveMonth, coachAnalyses, localGamesFinished,
  }), [spotsAnswered, studyStreak, bankrollSessions, bankrollPositiveMonth, coachAnalyses, localGamesFinished]);

  const eligibleCount = useMemo(() => eligibleKeys(signals).length, [signals]);
  const xpTotal = useMemo(() => computeXp(signals, eligibleCount), [signals, eligibleCount]);
  const rank = useMemo(() => rankForXp(xpTotal), [xpTotal]);

  const pillarsLoaded = studyLoaded && bankrollLoaded && coachLoaded;

  // ── React to changes: backfill once, then celebrate new unlocks + rank-ups ──
  useEffect(() => {
    if (!enabled || !stateLoaded || !pillarsLoaded) return;
    const now = new Date().toISOString();

    // First run: seed existing progress silently (no celebration flood).
    if (!state.seeded) {
      const seen: Record<string, string> = {};
      eligibleKeys(signals).forEach(k => { seen[k] = now; });
      const seeded: EngagementState = { ...state, seeded: true, seenAchievements: seen, lastXp: xpTotal };
      setState(seeded);
      store.saveState(seeded).catch(() => {});
      return;
    }

    let next = state;
    const newly = evaluate(signals, state.seenAchievements);
    if (newly.length > 0) {
      const seen = { ...state.seenAchievements };
      newly.forEach(k => { seen[k] = now; });
      next = { ...next, seenAchievements: seen };
      setUnlockQueue(q => [...q, ...newly.map(k => toDto(k, now))]);
    }
    if (rankForXp(xpTotal).index > rankForXp(state.lastXp).index) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2600);
    }
    if (next.lastXp !== xpTotal) next = { ...next, lastXp: xpTotal };
    if (next !== state) { setState(next); store.saveState(next).catch(() => {}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, stateLoaded, pillarsLoaded, xpTotal, signals]);

  const localAchievements: LocalAchievementView[] = useMemo(
    () => LOCAL_ACHIEVEMENTS.map(a => ({
      key: a.key, name: a.name, description: a.desc, iconKey: a.ionicon, rarity: a.rarity,
      earned: a.eligible(signals),
      unlockedAt: state.seenAchievements[a.key] ?? null,
    })),
    [signals, state.seenAchievements],
  );

  const value: EngagementContextType = { enabled, isLoaded: stateLoaded, xpTotal, rank, signals, localAchievements };

  return (
    <EngagementContext.Provider value={value}>
      {children}
      {enabled && unlockQueue.length > 0 && (
        <AchievementUnlock achievements={unlockQueue} onDone={() => setUnlockQueue([])} />
      )}
      {enabled && celebrate && <Celebration />}
    </EngagementContext.Provider>
  );
}

export function useEngagement(): EngagementContextType {
  const ctx = useContext(EngagementContext);
  if (!ctx) {
    // Safe fallback when the provider isn't mounted (e.g., retention off in some trees).
    return {
      enabled: false, isLoaded: false, xpTotal: 0,
      rank: rankForXp(0), signals: {
        spotsAnswered: 0, studyStreak: 0, bankrollSessions: 0,
        bankrollPositiveMonth: false, coachAnalyses: 0, localGamesFinished: 0,
      },
      localAchievements: [],
    };
  }
  return ctx;
}
