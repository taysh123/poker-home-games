import { canonicalize, computeContentHash, hashString } from '../hash';
import { validatePack } from '../validate';
import { prepareImport } from '../importPack';
import { identityAdapter, selectAdapter } from '../adapters';
import {
  validSolverPack,
  invalidSolverPack,
  tamperedSolverPack,
  danglingNodePack,
} from '../__fixtures__/solverPackFixtures';

describe('solver pack hash', () => {
  it('canonicalization is key-order-independent', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });
  it('hashString is deterministic + distinguishes content', () => {
    expect(hashString('hello')).toBe(hashString('hello'));
    expect(hashString('hello')).not.toBe(hashString('world'));
  });
  it('the valid fixture is self-consistent (manifest hash == computed)', () => {
    const p = validSolverPack();
    expect(p.manifest.contentHash).toBe(computeContentHash(p));
  });
});

describe('validatePack (fail-closed)', () => {
  it('accepts a valid solver pack', () => {
    expect(validatePack(validSolverPack())).toEqual({ ok: true, errors: [] });
  });
  it('rejects a non-object', () => {
    expect(validatePack(42).ok).toBe(false);
  });
  it('rejects a structurally invalid pack with specific errors', () => {
    const r = validatePack(invalidSolverPack());
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.some(e => /verificationTier/i.test(e))).toBe(true);
  });
  it('rejects a tampered pack (hash mismatch)', () => {
    const r = validatePack(tamperedSolverPack());
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => /contentHash mismatch/i.test(e))).toBe(true);
  });
  it('rejects a dangling node parentId (tree integrity)', () => {
    const r = validatePack(danglingNodePack());
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => /dangling/i.test(e))).toBe(true);
  });
  it('rejects a hand whose frequencies do not sum to ~1', () => {
    const p = validSolverPack();
    p.ranges[0].strategy.T9s = [{ action: 'raise', freq: 0.5 }]; // sums to 0.5
    p.manifest.contentHash = computeContentHash(p); // rehash so we isolate the freq check
    const r = validatePack(p);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => /sum/i.test(e))).toBe(true);
  });
  it('rejects an invalid hand key', () => {
    const p = validSolverPack();
    (p.ranges[0].strategy as Record<string, unknown>).ZZ = [{ action: 'fold', freq: 1 }];
    p.manifest.contentHash = computeContentHash(p);
    const r = validatePack(p);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => /valid hand key/i.test(e))).toBe(true);
  });
});

describe('adapters + prepareImport', () => {
  it('identity adapter handles a canonical pack; selectAdapter picks it', () => {
    expect(identityAdapter.canHandle(validSolverPack())).toBe(true);
    expect(selectAdapter(validSolverPack())?.id).toBe('identity');
    expect(selectAdapter(42)).toBeNull();
  });
  it('promotes a valid pack', () => {
    const r = prepareImport(validSolverPack());
    expect(r.ok).toBe(true);
    expect(r.pack?.manifest.id).toBe('fixture-solver-1');
  });
  it('rejects junk (no adapter) and invalid packs (fail-closed)', () => {
    expect(prepareImport(42).ok).toBe(false);
    expect(prepareImport(invalidSolverPack()).ok).toBe(false);
  });
});
