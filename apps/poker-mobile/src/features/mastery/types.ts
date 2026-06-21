/**
 * Mastery types (PR #7) — the five Mastery_Model dimensions (MM-01..05) from Release 0.8.1.
 * Pure data; no content/store coupling. The engine (logic/mastery.ts) computes these states from
 * per-objective attempt aggregates + the content structure (objective→concept/pack/track) supplied by callers.
 */
export type ObjectiveMastery = 'Novice' | 'Learning' | 'Proficient' | 'Mastered';        // MM-01
export type ConceptMastery = 'Aware' | 'Practiced' | 'Confident' | 'Expert';             // MM-02
export type PackMastery = 'Started' | 'InProgress' | 'Completed' | 'Mastered';           // MM-03
export type TrackMastery = 'Enrolled' | 'Progressing' | 'Track-Complete';                // MM-04
export type CertificationMastery = 'Eligible' | 'InExam' | 'Certified' | 'Expired';      // MM-05

/** Aggregated attempts for one objective (from EV-03 quiz_completed + EV-10 drill_attempted). */
export interface ObjectiveStat {
  attempts: number;
  correct: number;
  /** epoch ms of the most recent attempt (drives 30-day inactivity decay). */
  lastActivityTs?: number;
}

export interface CertificationInput {
  trackComplete: boolean;
  examScore?: number;        // 0..1
  examInProgress?: boolean;
  certifiedTs?: number;      // epoch ms when certified (drives 180-day recert)
}
