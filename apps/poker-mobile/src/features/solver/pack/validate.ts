/**
 * Pure, FAIL-CLOSED validation for canonical solver packs. Checks schema shape, required fields, allowable
 * enums (tiers/streets/actions), value ranges (freq/equity 0..1), node/tree integrity (no dangling parents,
 * no cycles, nodeRefs resolve), and the content-hash match. Returns all errors; never throws, never fabricates.
 */
import { computeContentHash } from './hash';
import { SOLVER_PACK_SCHEMA_VERSION, STREETS, VERIFICATION_TIERS } from './types';
import type { SolverNode, SolverPack } from './types';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const ACTIONS = ['fold', 'call', 'raise'];

export function validatePack(pack: unknown): ValidationResult {
  const errors: string[] = [];
  if (!pack || typeof pack !== 'object') return { ok: false, errors: ['pack is not an object'] };
  const p = pack as Partial<SolverPack>;

  const m = p.manifest;
  if (!m || typeof m !== 'object') {
    errors.push('manifest missing');
  } else {
    if (!m.id) errors.push('manifest.id missing');
    if (!m.name) errors.push('manifest.name missing');
    if (m.schemaVersion !== SOLVER_PACK_SCHEMA_VERSION) errors.push(`unsupported schemaVersion ${String(m.schemaVersion)}`);
    if (!VERIFICATION_TIERS.includes(m.verificationTier)) errors.push(`invalid verificationTier ${String(m.verificationTier)}`);
    if (!m.contentHash) errors.push('manifest.contentHash missing');
  }

  if (!Array.isArray(p.ranges) || p.ranges.length === 0) {
    errors.push('ranges missing/empty');
  } else {
    p.ranges.forEach((r, i) => {
      if (!r.id) errors.push(`ranges[${i}].id missing`);
      if (!r.strategy || typeof r.strategy !== 'object') {
        errors.push(`ranges[${i}].strategy missing`);
        return;
      }
      for (const [hand, mix] of Object.entries(r.strategy)) {
        if (!Array.isArray(mix)) {
          errors.push(`ranges[${i}].strategy['${hand}'] is not an array`);
          continue;
        }
        mix.forEach((a, j) => {
          if (!ACTIONS.includes(a.action)) errors.push(`ranges[${i}].strategy['${hand}'][${j}] invalid action ${String(a.action)}`);
          if (typeof a.freq !== 'number' || a.freq < 0 || a.freq > 1) errors.push(`ranges[${i}].strategy['${hand}'][${j}] freq out of range`);
          if (a.equity !== undefined && (typeof a.equity !== 'number' || a.equity < 0 || a.equity > 1)) errors.push(`ranges[${i}].strategy['${hand}'][${j}] equity out of range`);
          if (a.evBb !== undefined && !Number.isFinite(a.evBb)) errors.push(`ranges[${i}].strategy['${hand}'][${j}] evBb not a finite number`);
        });
      }
    });
  }

  if (p.nodes !== undefined) {
    if (!Array.isArray(p.nodes)) {
      errors.push('nodes is not an array');
    } else {
      const ids = new Set(p.nodes.map(n => n.id));
      if (ids.size !== p.nodes.length) errors.push('duplicate node ids');
      p.nodes.forEach((n, i) => {
        if (!n.id) errors.push(`nodes[${i}].id missing`);
        if (!STREETS.includes(n.street)) errors.push(`nodes[${i}].street invalid`);
        if (n.parentId && !ids.has(n.parentId)) errors.push(`nodes[${i}].parentId '${n.parentId}' dangling`);
      });
      if (hasCycle(p.nodes)) errors.push('node tree has a cycle');
      (p.ranges ?? []).forEach((r, i) => {
        (r.nodeRefs ?? []).forEach(ref => {
          if (!ids.has(ref)) errors.push(`ranges[${i}].nodeRefs '${ref}' dangling`);
        });
      });
    }
  }

  // Hash match — only when the pack is otherwise structurally sound enough to hash.
  if (errors.length === 0 && m) {
    const computed = computeContentHash(p as SolverPack);
    if (computed !== m.contentHash) errors.push(`contentHash mismatch (expected ${m.contentHash}, computed ${computed})`);
  }

  return { ok: errors.length === 0, errors };
}

function hasCycle(nodes: SolverNode[]): boolean {
  const parent = new Map(nodes.map(n => [n.id, n.parentId]));
  for (const start of nodes) {
    const seen = new Set<string>();
    let cur: string | undefined = start.id;
    while (cur) {
      if (seen.has(cur)) return true;
      seen.add(cur);
      cur = parent.get(cur);
    }
  }
  return false;
}
