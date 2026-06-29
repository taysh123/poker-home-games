import { validate } from '../validate';
import { validRfiPack, rfiSchema, makePack } from './fixtures';
import type { Row } from '../types';

describe('validate (per-pack rules)', () => {
  it('passes a well-formed pack (soft link → warning, still ok)', () => {
    const r = validate(validRfiPack());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/soft links/);
  });

  it('flags enum violation', () => {
    const rows: Row[] = [{ RowID: 'X', Position: 'ZZ', Hand: 'AA', Frequency: 100, VerificationTier: 'Calibrated', SolveConfigID: null, Status: 'Approved', LinkedLessonID: null }];
    const r = validate(makePack({ schema: rfiSchema, rows }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Position.*not in allowed/);
  });

  it('flags missing required value', () => {
    const rows: Row[] = [{ RowID: 'X', Position: 'CO', Hand: '', Frequency: 100, VerificationTier: 'Calibrated', SolveConfigID: null, Status: 'Approved', LinkedLessonID: null }];
    const r = validate(makePack({ schema: rfiSchema, rows }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/required column "Hand"/);
  });

  it('flags Solver-Verified without SolveConfigID (value check, not FK)', () => {
    const rows: Row[] = [{ RowID: 'X', Position: 'CO', Hand: 'AA', Frequency: 100, VerificationTier: 'Solver-Verified', SolveConfigID: null, Status: 'Approved', LinkedLessonID: null }];
    const r = validate(makePack({ schema: rfiSchema, rows }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Solver-Verified requires .*SolveConfigID/);
  });

  it('passes Solver-Verified WITH a SolveConfigID (positive case)', () => {
    const rows: Row[] = [{ RowID: 'X', Position: 'CO', Hand: 'AA', Frequency: 100, VerificationTier: 'Solver-Verified', SolveConfigID: 'SR-001', Status: 'Approved', LinkedLessonID: null }];
    const r = validate(makePack({ schema: rfiSchema, rows }));
    expect(r.ok).toBe(true);
  });

  it('flags non-exportable Status', () => {
    const rows: Row[] = [{ RowID: 'X', Position: 'CO', Hand: 'AA', Frequency: 100, VerificationTier: 'Calibrated', SolveConfigID: null, Status: 'Draft', LinkedLessonID: null }];
    const r = validate(makePack({ schema: rfiSchema, rows }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Status="Draft" is not exportable/);
  });

  it('flags content_hash mismatch', () => {
    const r = validate(makePack({ schema: rfiSchema, rows: validRfiPack().rows, hashOverride: 'deadbeef' }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/content_hash mismatch/);
  });

  it('flags row_count mismatch', () => {
    const r = validate(makePack({ schema: rfiSchema, rows: validRfiPack().rows, rowCountOverride: 99 }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/row_count mismatch/);
  });
});
