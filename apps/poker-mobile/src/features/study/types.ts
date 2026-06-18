/**
 * Study module domain model (V2 — Study pillar).
 *
 * Engagement-first (Spot/Decision trainers, streaks, quizzes) but the DATA architecture
 * is a full GTO platform substrate: ranges are data-driven with mixed-frequency
 * strategies, so the same dataset later powers a Range Viewer / Explorer, solver imports,
 * and postflop content — without reshaping anything. Starter ranges are flagged
 * `isIllustrative` (training content) until verified solver data replaces them.
 */

export type StudyFormat = 'cash' | 'mtt';
/** v1 scenarios; postflop / 3bet+ scenarios extend this union later. */
export type RangeScenario = 'RFI' | 'vs_RFI';
export type RangeAction = 'fold' | 'call' | 'raise';

/** A (possibly mixed) action with its frequency 0..1 and optional sizing in bb. */
export interface ActionFrequency {
  action: RangeAction;
  freq: number;
  sizeBb?: number;
}

/** Canonical 169-hand key: 'AA' | 'AKs' | 'AKo'. */
export type HandKey = string;

/** Per-hand strategy: hand → action mix (frequencies sum to 1). */
export type HandStrategy = Record<HandKey, ActionFrequency[]>;

export interface PreflopRange {
  id: string;
  format: StudyFormat;
  tableSize: number;       // 9, 6, …
  stackBb: number;         // effective stack in bb
  scenario: RangeScenario;
  heroPosition: string;    // 'UTG' | 'CO' | 'BTN' | 'SB' | 'BB' | …
  villainPosition?: string;// for vs_RFI
  openSizeBb?: number;     // open / facing size context
  label: string;
  strategy: HandStrategy;
}

/** Replaceable dataset envelope — also the IMPORT format for future solver data. */
export interface RangeDataset {
  schemaVersion: 1;
  name: string;
  /** TRUE for the bundled starter pack; set FALSE only for verified solver data. */
  isIllustrative: boolean;
  ranges: PreflopRange[];
}

export const STUDY_SCHEMA_VERSION = 1 as const;

/** Persisted study progress (engagement + habit formation). */
export interface StudyProgress {
  schemaVersion: typeof STUDY_SCHEMA_VERSION;
  totalAnswered: number;
  totalCorrect: number;
  dailyGoal: number;
  /** yyyy-mm-dd → spots answered that day (drives streaks + daily goal). */
  dailyCounts: Record<string, number>;
  lastStudyDate?: string;
  currentStreak: number;
  longestStreak: number;
}

export interface StudyFile {
  schemaVersion: typeof STUDY_SCHEMA_VERSION;
  progress: StudyProgress;
}
