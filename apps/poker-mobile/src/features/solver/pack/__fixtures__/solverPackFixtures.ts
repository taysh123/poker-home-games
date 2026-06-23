/**
 * TEST-ONLY solver-pack fixtures. NOT shipped in the app bundle (only test files import this; lives under
 * `__fixtures__/` so Jest does not treat it as a suite). These are synthetic packs to exercise the import
 * pipeline + validation flow — NOT real solver output and never presented to users.
 */
import { computeContentHash } from '../hash';
import type { SolverPack } from '../types';

/** A self-consistent, valid 'solver'-tier pack (EV/equity/node present) for happy-path tests. */
export function validSolverPack(): SolverPack {
  const pack: SolverPack = {
    manifest: {
      id: 'fixture-solver-1',
      name: 'Fixture Solver Pack',
      schemaVersion: 1,
      verificationTier: 'solver',
      contentHash: '',
      importedAt: '2026-06-24T00:00:00.000Z',
      solverEngine: 'FixtureSolver',
      solverVersion: '0.0.0',
      verifiedBy: 'test',
      verifiedAt: '2026-06-24T00:00:00.000Z',
    },
    ranges: [
      {
        id: 'r1',
        format: 'cash',
        tableSize: 6,
        stackBb: 100,
        scenario: 'RFI',
        heroPosition: 'BTN',
        label: 'BTN RFI (fixture)',
        verificationTier: 'solver',
        nodeRefs: ['n-root'],
        strategy: {
          AA: [{ action: 'raise', freq: 1, evBb: 3.2, equity: 0.85 }],
          '72o': [{ action: 'fold', freq: 1, evBb: 0 }],
          T9s: [{ action: 'raise', freq: 0.7, evBb: 0.4 }, { action: 'fold', freq: 0.3 }],
        },
      },
    ],
    nodes: [{ id: 'n-root', path: ['root'], street: 'preflop', rangeId: 'r1' }],
  };
  pack.manifest.contentHash = computeContentHash(pack);
  return pack;
}

/** Structurally invalid (missing id, bad tier, freq out of range) — exercises fail-closed + quarantine. */
export function invalidSolverPack(): unknown {
  return {
    manifest: { name: 'Bad', schemaVersion: 1, verificationTier: 'bogus', contentHash: 'x', importedAt: '' },
    ranges: [{ id: 'r1', strategy: { AA: [{ action: 'raise', freq: 2 }] } }],
  };
}

/** Valid shape but content mutated AFTER hashing → contentHash mismatch. */
export function tamperedSolverPack(): SolverPack {
  const pack = validSolverPack();
  pack.ranges[0].strategy.AA[0].freq = 0.5;
  return pack;
}

/** Valid hash but a dangling node parentId → tree-integrity failure. */
export function danglingNodePack(): SolverPack {
  const pack = validSolverPack();
  pack.nodes = [{ id: 'n-root', path: ['root'], street: 'preflop', parentId: 'does-not-exist' }];
  pack.manifest.contentHash = computeContentHash(pack);
  return pack;
}
