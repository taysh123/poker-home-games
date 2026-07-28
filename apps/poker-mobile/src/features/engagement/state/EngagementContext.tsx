import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isFeatureEnabled } from '../../../config/features';
import { useStudy } from '../../study/state/StudyContext';
import { useBankroll } from '../../bankroll/state/BankrollContext';
import { useCoach } from '../../coach/state/CoachContext';
import { useLocalGames } from '../../../context/LocalGamesContext';
import { sessionNetCents } from '../../bankroll/logic/bankrollAnalytics';
import { computeXp, rankForXp, xpAchievementCount, type RankInfo } from '../logic/xp';
import { LOCAL_ACHIEVEMENTS, evaluate, eligibleKeys, findAchievement, isEarned } from '../logic/achievements';
import { deriveIsCelebrating } from '../logic/celebration';
import { localMonthKey } from '../../study/logic/localDay';
import * as store from '../data/engagementStore';
import { track } from '../../../utils/analytics';
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
  /**
   * Q1.4 — true while ANY celebration this provider owns is on screen. The review-prompt host
   * consumes this so its sheet never rises over confetti. Includes `enabled` because both
   * celebration renders below are gated on it: with `retention` OFF nothing can appear, and
   * reporting "celebrating" there would suppress the review prompt forever.
   */
  isCelebrating: boolean;
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
  const { games, isLoaded: gamesLoaded } = useLocalGames();

  const [state, setState] = useState<EngagementState>(store.emptyState());
  const [stateLoaded, setStateLoaded] = useState(false);
  const [unlockQueue, setUnlockQueue] = useState<AchievementDto[]>([]);
  const [celebrate, setCelebrate] = useState(false);

  // Tracks previous celebration-trigger signal values so we can detect when a
  // game or quiz JUST finished — and delay the rank-up burst accordingly so it
  // never plays simultaneously with a screen-level Celebration.
  const prevCelebrationTriggerRef = React.useRef({ localGamesFinished: 0, quizzesCompleted: 0 });
  // The FIRST evaluation after state load is a catch-up, not user action — a restorative XP
  // delta there (e.g. the Q0 seen-based formula raising a previously docked total) must sync
  // lastXp silently, never celebrate at an idle cold open (Q0 finds m0/m7).
  const hasEvaluatedOnceRef = React.useRef(false);

  useEffect(() => {
    let cancelled = false;
    store.loadState().then(s => { if (!cancelled) { setState(s); setStateLoaded(true); } });
    return () => { cancelled = true; };
  }, []);

  // ── Derive signals from the local pillars ──
  const spotsAnswered = progress.totalAnswered;
  const studyStreak = progress.currentStreak;
  // MONOTONIC study-day credit (0.4): distinct days with ≥1 answer — never shrinks, unlike the streak.
  const studyDays = useMemo(
    () => Object.values(progress.dailyCounts).filter(c => c > 0).length,
    [progress.dailyCounts],
  );
  const quizzesCompleted = progress.quizzesCompleted ?? 0;
  const lessonsCompleted = progress.lessonsCompleted ?? 0;
  const bankrollSessions = sessions.length;
  const coachAnalyses = history.length;
  const localGamesFinished = useMemo(() => games.filter(g => g.status === 'Finished').length, [games]);
  const bankrollPositiveMonth = useMemo(() => {
    // LOCAL month on both sides — the previous UTC-ISO month slice bucketed the first hours of
    // every month into the PREVIOUS month in positive-offset timezones (Q0; dayKeyBan-guarded).
    const month = localMonthKey();
    const net = sessions
      .filter(s => localMonthKey(new Date(s.startedAt)) === month)
      .reduce((sum, s) => sum + sessionNetCents(s), 0);
    return net > 0;
  }, [sessions]);

  const signals: EngagementSignals = useMemo(() => ({
    spotsAnswered, studyStreak, studyDays, bankrollSessions, bankrollPositiveMonth, coachAnalyses, localGamesFinished,
    quizzesCompleted, lessonsCompleted,
  }), [spotsAnswered, studyStreak, studyDays, bankrollSessions, bankrollPositiveMonth, coachAnalyses, localGamesFinished, quizzesCompleted, lessonsCompleted]);

  // XP counts permanently-SEEN achievements, never live eligibility — volatile predicates
  // (streaks, month windows) used to dock XP by 25 per lapsed badge and could re-fire the
  // rank-up celebration on re-crossing, violating the monotonic pin (Q0).
  const unlockedCount = useMemo(() => xpAchievementCount(state.seenAchievements), [state.seenAchievements]);
  const xpTotal = useMemo(() => computeXp(signals, unlockedCount), [signals, unlockedCount]);
  const rank = useMemo(() => rankForXp(xpTotal), [xpTotal]);

  // LocalGames included (Q0 find m2): seeding with games still loading missed play_first and
  // then celebrated it seconds later — the flood the silent seed exists to prevent.
  const pillarsLoaded = studyLoaded && bankrollLoaded && coachLoaded && gamesLoaded;

  // ── React to changes: backfill once, then celebrate new unlocks + rank-ups ──
  useEffect(() => {
    if (!enabled || !stateLoaded || !pillarsLoaded) return;
    const now = new Date().toISOString();

    // Snapshot prev trigger values BEFORE any early return so every run updates
    // the ref — including the seeding run — giving accurate diffs on the next run.
    const prevTrigger = prevCelebrationTriggerRef.current;
    prevCelebrationTriggerRef.current = {
      localGamesFinished: signals.localGamesFinished,
      quizzesCompleted: signals.quizzesCompleted,
    };

    // First run: seed existing progress silently (no celebration flood). lastXp must be the
    // POST-seed value (seen-based) or the next render's XP jump would fire a phantom rank-up.
    if (!state.seeded) {
      const seen: Record<string, string> = {};
      eligibleKeys(signals).forEach(k => { seen[k] = now; });
      const seeded: EngagementState = { ...state, seeded: true, seenAchievements: seen, lastXp: computeXp(signals, xpAchievementCount(seen)) };
      setState(seeded);
      store.saveState(seeded).catch(() => {});
      hasEvaluatedOnceRef.current = true; // post-seed state is self-consistent — next run is live
      return;
    }

    let next = state;
    const newly = evaluate(signals, state.seenAchievements);
    if (newly.length > 0) {
      const seen = { ...state.seenAchievements };
      newly.forEach(k => { seen[k] = now; });
      next = { ...next, seenAchievements: seen };
      setUnlockQueue(q => [...q, ...newly.map(k => toDto(k, now))]);
      newly.forEach(k => track('achievement_unlocked', { key: k, rarity: findAchievement(k)?.rarity, source: 'local' }));
    }
    // Rank check runs on the PROJECTED total (this run's unlocks included): the +25 for a fresh
    // unlock otherwise lands one render late, where the game/quiz trigger diff is already
    // consumed and the burst would bypass the anti-overlap delays (Q0 find m1).
    const projectedXp = computeXp(signals, xpAchievementCount(next.seenAchievements));
    if (hasEvaluatedOnceRef.current && rankForXp(projectedXp).index > rankForXp(state.lastXp).index) {
      // Track immediately; delay the visual burst so it never plays simultaneously
      // with a screen-level Celebration (game-end = 5.04 s; study success = 1.5 s).
      track('rank_up', { rank: rankForXp(projectedXp).rank.name });
      const screenBurstMs =
        signals.localGamesFinished > prevTrigger.localGamesFinished ? 5500 :
        signals.quizzesCompleted > prevTrigger.quizzesCompleted ? 2000 :
        0;
      setTimeout(() => {
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 2600);
      }, screenBurstMs);
    }
    hasEvaluatedOnceRef.current = true;
    // Ratchet: lastXp only ever rises (Q0 find m2 — a transient empty pillar must not drag the
    // celebration baseline down and replay a rank-up later).
    if (projectedXp > next.lastXp) next = { ...next, lastXp: projectedXp };
    if (next !== state) { setState(next); store.saveState(next).catch(() => {}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, stateLoaded, pillarsLoaded, xpTotal, signals]);

  const localAchievements: LocalAchievementView[] = useMemo(
    () => LOCAL_ACHIEVEMENTS.map(a => ({
      key: a.key, name: a.name, description: a.desc, iconKey: a.ionicon, rarity: a.rarity,
      // seen || eligible — a celebrated badge never visually re-locks when its predicate lapses (Q0).
      earned: isEarned(a, signals, state.seenAchievements),
      unlockedAt: state.seenAchievements[a.key] ?? null,
    })),
    [signals, state.seenAchievements],
  );

  const value: EngagementContextType = {
    enabled, isLoaded: stateLoaded, xpTotal, rank, signals, localAchievements,
    // Mirrors the render gates below exactly — if you change those, change this. Extracted to a
    // pure fn so every term is pinned (logic/__tests__/celebration.test.ts); as an inline
    // expression, dropping `enabled` or `celebrate` survived mutation testing.
    isCelebrating: deriveIsCelebrating({ enabled, unlockQueueLength: unlockQueue.length, celebrate }),
  };

  return (
    <EngagementContext.Provider value={value}>
      {children}
      {enabled && unlockQueue.length > 0 && (
        <AchievementUnlock achievements={unlockQueue} onDone={() => setUnlockQueue([])} />
      )}
      {/* Gate: suppress rank-up burst while AchievementUnlock (which fires its own
          Celebration) is visible — never let two Celebrations play at once. */}
      {enabled && celebrate && unlockQueue.length === 0 && (
        <Celebration variant="success" />
      )}
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
        spotsAnswered: 0, studyStreak: 0, studyDays: 0, bankrollSessions: 0,
        bankrollPositiveMonth: false, coachAnalyses: 0, localGamesFinished: 0,
        quizzesCompleted: 0, lessonsCompleted: 0,
      },
      localAchievements: [],
      isCelebrating: false,
    };
  }
  return ctx;
}
