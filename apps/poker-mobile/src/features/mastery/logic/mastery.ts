/**
 * Mastery engine (PR #7) — PURE implementation of Mastery_Model MM-01..05 (Release 0.8.0).
 * Computed from attempt aggregates + content structure (passed in by callers), never from the workbook.
 * Foundation only: not yet wired to live analytics events (that arrives with the analytics PR).
 *
 * Threshold provenance:
 *  - WORKBOOK-PINNED (from Mastery_Model.ThresholdConfig): Mastered = acc≥85% over ≥20 attempts (MM-01);
 *    30-day inactivity demotion (MM-01); Concept "Confident" = ≥2 objectives Proficient+ (MM-02);
 *    Pack gate = ≥80% objectives Mastered (MM-03); Track = ≥90% modules complete (MM-04);
 *    Cert = exam≥80% AND track-complete, recert after 180 days (MM-05).
 *  - APP-DEFAULT (intermediate bands the workbook left to the app; documented + centralized here).
 */
import type {
  ObjectiveMastery, ConceptMastery, PackMastery, TrackMastery, CertificationMastery,
  ObjectiveStat, CertificationInput,
} from '../types';

const DAY = 86_400_000;

export const MASTERY_CONFIG = {
  masteredAccuracy: 0.85,      // MM-01 (pinned)
  masteredMinAttempts: 20,     // MM-01 (pinned)
  proficientAccuracy: 0.70,    // app-default
  proficientMinAttempts: 10,   // app-default
  learningMinAttempts: 3,      // app-default (below → Novice)
  inactivityDecayDays: 30,     // MM-01 (pinned)
  packMasteredGate: 0.8,       // MM-03 (pinned)
  trackCompleteGate: 0.9,      // MM-04 (pinned)
  certExamPass: 0.8,           // MM-05 (pinned)
  certRecertDays: 180,         // MM-05 (pinned)
} as const;

const OBJ_ORDER: ObjectiveMastery[] = ['Novice', 'Learning', 'Proficient', 'Mastered'];

function rawObjective(stat: ObjectiveStat): ObjectiveMastery {
  const { attempts, correct } = stat;
  if (attempts < MASTERY_CONFIG.learningMinAttempts) return 'Novice';
  const acc = attempts > 0 ? correct / attempts : 0;
  if (acc >= MASTERY_CONFIG.masteredAccuracy && attempts >= MASTERY_CONFIG.masteredMinAttempts) return 'Mastered';
  if (acc >= MASTERY_CONFIG.proficientAccuracy && attempts >= MASTERY_CONFIG.proficientMinAttempts) return 'Proficient';
  return 'Learning';
}

/** MM-01: objective state from attempts, with one-level demotion after 30 days of inactivity. */
export function objectiveMastery(stat: ObjectiveStat, nowTs: number = Date.now()): ObjectiveMastery {
  const base = rawObjective(stat);
  if (stat.lastActivityTs && (nowTs - stat.lastActivityTs) / DAY > MASTERY_CONFIG.inactivityDecayDays) {
    return OBJ_ORDER[Math.max(0, OBJ_ORDER.indexOf(base) - 1)];
  }
  return base;
}

const isProficientPlus = (o: ObjectiveMastery) => o === 'Proficient' || o === 'Mastered';

/** MM-02: concept state from its objectives' states (inherits objective decay via inputs). */
export function conceptMastery(objectiveStates: ObjectiveMastery[]): ConceptMastery {
  if (objectiveStates.length > 0 && objectiveStates.every(o => o === 'Mastered')) return 'Expert';
  const proficientPlus = objectiveStates.filter(isProficientPlus).length;
  if (proficientPlus >= 2) return 'Confident'; // MM-02 pinned
  if (proficientPlus === 1) return 'Practiced';
  return 'Aware';
}

/** MM-03: pack state from member objectives' states (gate = ≥80% Mastered). */
export function packMastery(objectiveStates: ObjectiveMastery[]): PackMastery {
  if (objectiveStates.length === 0) return 'Started';
  const masteredPct = objectiveStates.filter(o => o === 'Mastered').length / objectiveStates.length;
  if (masteredPct >= 1) return 'Mastered';
  if (masteredPct >= MASTERY_CONFIG.packMasteredGate) return 'Completed'; // MM-03 pinned
  return objectiveStates.some(o => o !== 'Novice') ? 'InProgress' : 'Started';
}

/** MM-04: track state from per-module objective states (a module is complete when all objectives are Proficient+). */
export function trackMastery(modules: ObjectiveMastery[][]): TrackMastery {
  if (modules.length === 0) return 'Enrolled';
  const moduleComplete = (objs: ObjectiveMastery[]) => objs.length > 0 && objs.every(isProficientPlus);
  const completePct = modules.filter(moduleComplete).length / modules.length;
  if (completePct >= MASTERY_CONFIG.trackCompleteGate) return 'Track-Complete'; // MM-04 pinned
  return modules.some(objs => objs.some(o => o !== 'Novice')) ? 'Progressing' : 'Enrolled';
}

/** MM-05: certification state. Precondition for real eligibility is trackComplete (enforced here);
 *  Certified requires exam≥80% AND track-complete; recertify after 180 days. */
export function certificationMastery(input: CertificationInput, nowTs: number = Date.now()): CertificationMastery {
  if (input.certifiedTs) {
    return (nowTs - input.certifiedTs) / DAY > MASTERY_CONFIG.certRecertDays ? 'Expired' : 'Certified';
  }
  if (input.examInProgress) return 'InExam';
  if (input.trackComplete && input.examScore != null && input.examScore >= MASTERY_CONFIG.certExamPass) return 'Certified';
  return 'Eligible'; // resting state; the UI gates the exam behind trackComplete
}
