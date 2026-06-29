/**
 * Pure import pipeline: select adapter → convert → validate (schema/enums/hash/tree). NO storage side-effects,
 * so it's fully unit-testable. FAIL-CLOSED: no adapter / conversion throw / invalid pack ⇒ `{ ok: false }` with
 * errors. Never fabricates. The async store layer (`data/solverPackStore.ts`) wraps this to promote or quarantine.
 */
import { selectAdapter } from './adapters';
import { validatePack } from './validate';
import type { SolverPack } from './types';

export interface PrepareResult {
  ok: boolean;
  pack?: SolverPack;
  errors: string[];
}

export function prepareImport(raw: unknown): PrepareResult {
  const adapter = selectAdapter(raw);
  if (!adapter) return { ok: false, errors: ['no adapter can handle this input'] };

  let pack: SolverPack;
  try {
    pack = adapter.toPack(raw);
  } catch (e) {
    return { ok: false, errors: [`adapter '${adapter.id}' failed: ${(e as Error).message}`] };
  }

  const result = validatePack(pack);
  return result.ok ? { ok: true, pack, errors: [] } : { ok: false, errors: result.errors };
}
