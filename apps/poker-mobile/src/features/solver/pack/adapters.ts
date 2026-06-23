/**
 * Pluggable solver-export adapter seam. An adapter converts a raw external export INTO the canonical
 * `SolverPack` — the canonical format is the single representation everything downstream consumes.
 *
 * VENDOR-NEUTRAL: no concrete external adapter is invented here. Future adapters (GTO Wizard / PioSolver /
 * GTO+ / Monker / custom) register in `ADAPTERS` once a REAL export sample/spec is provided. Until then only
 * the `identityAdapter` (already-canonical passthrough) exists.
 */
import type { SolverPack } from './types';

export interface SolverAdapter {
  id: string;
  /** Cheap shape check: can this adapter convert the raw input? */
  canHandle(raw: unknown): boolean;
  /** Convert raw → canonical SolverPack. May throw on malformed input (the pipeline catches + quarantines). */
  toPack(raw: unknown): SolverPack;
}

/** Passthrough: the raw input is already a canonical SolverPack (has manifest + ranges). */
export const identityAdapter: SolverAdapter = {
  id: 'identity',
  canHandle(raw) {
    return !!raw && typeof raw === 'object' && 'manifest' in (raw as object) && 'ranges' in (raw as object);
  },
  toPack(raw) {
    return raw as SolverPack;
  },
};

/** Registered adapters, in priority order. External adapters are added only with a real export sample. */
export const ADAPTERS: readonly SolverAdapter[] = [identityAdapter];

export function selectAdapter(raw: unknown): SolverAdapter | null {
  return ADAPTERS.find(a => a.canHandle(raw)) ?? null;
}
