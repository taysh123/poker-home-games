/**
 * Pack validation (PR #2) — PURE, single-pack. Implements the export-contract `_validation` rules that
 * can be checked without other tables: enum membership, required present, Solver-Verified ⇒ SolveConfigID
 * (value check, NOT a DB FK — `solver_runs` isn't ingested; risk R3), content_hash match, and structural
 * (row_count, Status ∈ {Published,Approved}). Hard-FK *resolution* is cross-table → done by the store at
 * commit (see contentStore.resolveForeignKeys). Soft '(node)' links are warnings, never blockers (R12).
 */
import { type ContentPack, isRequired, parseHardFk } from './types';
import type { ValidationReport } from './types';
import { contentHash } from './hash';

const EXPORTABLE_STATUS = new Set(['Published', 'Approved']);

function isMissing(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

export function validate(pack: ContentPack): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { manifest, schema, rows } = pack;

  if (!schema || schema.length === 0) errors.push('schema is empty');
  if (typeof manifest?.content_hash !== 'string' || manifest.content_hash.length === 0) {
    errors.push('manifest.content_hash missing');
  }
  if (manifest && typeof manifest.row_count === 'number' && manifest.row_count !== rows.length) {
    errors.push(`row_count mismatch: manifest=${manifest.row_count} actual=${rows.length}`);
  }

  const cols = new Set(schema.map(c => c.column));
  const hasTier = cols.has('VerificationTier');
  const hasSolveCfg = cols.has('SolveConfigID');
  const hasStatus = cols.has('Status');

  rows.forEach((row, i) => {
    for (const col of schema) {
      const v = row[col.column];
      if (isRequired(col) && isMissing(v)) errors.push(`row ${i}: required column "${col.column}" is empty`);
      if (col.allowed && col.allowed.length && !isMissing(v) && !col.allowed.includes(String(v))) {
        errors.push(`row ${i}: "${col.column}"="${String(v)}" not in allowed [${col.allowed.join(', ')}]`);
      }
      if (parseHardFk(col.fk)) {
        // resolution deferred to the store; presence noted once
      } else if (col.fk === '(node)') {
        // soft polymorphic link — never a blocker
      }
    }
    if (hasTier && hasSolveCfg && row['VerificationTier'] === 'Solver-Verified' && isMissing(row['SolveConfigID'])) {
      errors.push(`row ${i}: Solver-Verified requires a non-empty SolveConfigID`);
    }
    if (hasStatus && !isMissing(row['Status']) && !EXPORTABLE_STATUS.has(String(row['Status']))) {
      errors.push(`row ${i}: Status="${String(row['Status'])}" is not exportable (Published/Approved only)`);
    }
  });

  // Soft-link advisory (once per pack)
  const softCols = schema.filter(c => c.fk === '(node)').map(c => c.column);
  if (softCols.length) warnings.push(`soft links not resolved (by design): ${softCols.join(', ')}`);

  // Integrity hash last (only if structurally sane enough to compute)
  if (manifest && typeof manifest.content_hash === 'string' && manifest.content_hash.length) {
    const recomputed = contentHash({ rows, schema });
    if (recomputed !== manifest.content_hash) {
      errors.push(`content_hash mismatch: manifest=${manifest.content_hash.slice(0, 12)}… recomputed=${recomputed.slice(0, 12)}…`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
