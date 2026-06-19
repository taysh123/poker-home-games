/**
 * Engagement module (V2.1 STEP 3.2) — XP/rank + local pillar achievements, DERIVED from existing
 * local signals (study/bankroll/coach/local-games). Nothing new is persisted except "already
 * celebrated" markers, so unlock + rank-up animations fire exactly once. Local-first, cosmetic.
 */

/** Aggregate counts read from the local pillars; the single input to all engagement math. */
export interface EngagementSignals {
  spotsAnswered: number;
  studyStreak: number;
  bankrollSessions: number;
  bankrollPositiveMonth: boolean;
  coachAnalyses: number;
  localGamesFinished: number;
}

export const ENGAGEMENT_SCHEMA_VERSION = 1 as const;

/** Persisted state: only what's needed to avoid re-celebrating. */
export interface EngagementState {
  schemaVersion: typeof ENGAGEMENT_SCHEMA_VERSION;
  /** achievement key → ISO timestamp first seen unlocked. */
  seenAchievements: Record<string, string>;
  /** XP at last evaluation (to detect rank-ups). */
  lastXp: number;
  /** First-run backfill done — existing progress is seeded silently (no celebration flood). */
  seeded?: boolean;
}
