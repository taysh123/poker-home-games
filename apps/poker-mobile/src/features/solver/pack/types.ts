/**
 * T Poker CANONICAL solver-pack format.
 *
 * Vendor-neutral: external solver exports (GTO Wizard / PioSolver / GTO+ / Monker / custom) convert INTO this
 * via adapters; this is the single canonical representation the workspace consumes. Additive over the study
 * range model (reuses `PreflopRange`/`HandStrategy`, which now carry optional `evBb`/`equity`). EV/equity/node
 * data appear ONLY in imported verified packs — never fabricated.
 */
import type { HandStrategy, PreflopRange, RangeScenario, StudyFormat } from '../../study/types';

export const SOLVER_PACK_SCHEMA_VERSION = 1 as const;

/** Honesty tier of a pack's data. */
export type VerificationTier = 'solver' | 'calibrated' | 'illustrative';
export const VERIFICATION_TIERS: readonly VerificationTier[] = ['solver', 'calibrated', 'illustrative'];

export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export const STREETS: readonly Street[] = ['preflop', 'flop', 'turn', 'river'];

/** A node in the (future) solver decision tree. range↔node: a node references the range/strategy at that spot. */
export interface SolverNode {
  id: string;
  /** Ordered breadcrumb from the root to this node (for the future tree viewer). */
  path: string[];
  street: Street;
  parentId?: string;
  rangeId?: string;
  label?: string;
}

/** A range in a pack — a study `PreflopRange` plus optional pack provenance + node refs (additive). */
export interface SolverRange extends PreflopRange {
  verificationTier?: VerificationTier;
  nodeRefs?: string[]; // ids into SolverPack.nodes
}

export interface SolverPackManifest {
  id: string;
  name: string;
  schemaVersion: typeof SOLVER_PACK_SCHEMA_VERSION;
  verificationTier: VerificationTier;
  /** Content checksum over the pack (manifest sans contentHash + ranges + nodes). Integrity, not a signature. */
  contentHash: string;
  importedAt: string;          // ISO
  importVersion?: number;
  sourceSolver?: string;       // e.g. 'GTO Wizard'
  sourceVersion?: string;
  scenario?: RangeScenario | string;
  format?: StudyFormat;
  tableSize?: number;
  stackBb?: number;
  positions?: string[];
  baselinePackId?: string;     // compare/baseline lineage
  // Verification provenance (additive/optional).
  verifiedBy?: string;
  verifiedAt?: string;         // ISO
  solverEngine?: string;
  solverVersion?: string;
}

export interface SolverPack {
  manifest: SolverPackManifest;
  ranges: SolverRange[];
  nodes?: SolverNode[];
}

// Re-export for convenience.
export type { HandStrategy };
