import { createContentStore } from '../contentStore';
import { createMemoryBackend } from '../memoryBackend';
import { validRfiPack, modulesPack, lessonsPack, compositePack, makePack, rfiSchema } from './fixtures';
import type { Row } from '../types';

const store = () => createContentStore(createMemoryBackend());

describe('ContentStore — ingest lifecycle (memory backend)', () => {
  it('ingests a valid set, then serves it', async () => {
    const s = store();
    const res = await s.ingest([validRfiPack(), compositePack()]);
    expect(res.every(r => r.ok)).toBe(true);
    expect(await s.datasetVersion()).toBe('0.8.1');
    expect((await s.tables()).sort()).toEqual(['content_packs', 'rfi_ranges']);
    expect(await s.getAll('rfi_ranges')).toHaveLength(2);
    expect(await s.getById('rfi_ranges', { RowID: 'RFI-0002' })).toMatchObject({ Hand: 'T9s' });
    expect(await s.find('rfi_ranges', { Position: 'CO' })).toHaveLength(2);
    // composite PK lookup
    expect(await s.getById('content_packs', { PackID: 'PACK-01', ModuleID: 'LM-01' })).toMatchObject({ Tags: ['core', 'cash'] });
    expect(s.quarantine()).toEqual([]);
  });

  it('quarantines an invalid pack but commits the valid ones', async () => {
    const s = store();
    const bad = makePack({ packId: 'pack.bad', sheet: 'Bad_Sheet', schema: rfiSchema, rows: validRfiPack().rows, hashOverride: 'nope' });
    const res = await s.ingest([validRfiPack(), bad]);
    expect(res.find(r => r.packId === 'pack.rfi')!.ok).toBe(true);
    expect(res.find(r => r.packId === 'pack.bad')!.quarantined).toBe(true);
    expect(s.quarantine().map(q => q.packId)).toContain('pack.bad');
    expect(await s.tables()).toEqual(['rfi_ranges']); // bad sheet not committed
  });

  it('resolves hard FKs across the set (lessons → modules)', async () => {
    const s = store();
    const res = await s.ingest([modulesPack(), lessonsPack('LM-01')]);
    expect(res.every(r => r.ok)).toBe(true);
    expect((await s.tables()).sort()).toEqual(['learning_modules', 'lesson_content']);
  });

  it('quarantines a pack with a dangling hard FK', async () => {
    const s = store();
    // lessons references LM-99 which modules does not contain
    const res = await s.ingest([modulesPack(), lessonsPack('LM-99')]);
    expect(res.find(r => r.packId === 'pack.lessons')!.quarantined).toBe(true);
    expect(s.quarantine().some(q => q.reason === 'foreign_key')).toBe(true);
    expect(await s.tables()).toEqual(['learning_modules']);
  });

  it('cascade-quarantines a dependent when its referenced pack is invalid', async () => {
    const s = store();
    const badModules = makePack({ packId: 'pack.modules', sheet: 'Learning_Modules', schema: modulesPack().schema, rows: modulesPack().rows, hashOverride: 'bad' });
    const res = await s.ingest([badModules, lessonsPack('LM-01')]);
    // modules invalid (hash) → lessons FK dangles → both out; nothing committed → prior (empty) kept
    expect(res.find(r => r.packId === 'pack.modules')!.quarantined).toBe(true);
    expect(res.find(r => r.packId === 'pack.lessons')!.quarantined).toBe(true);
    expect(await s.tables()).toEqual([]);
  });

  it('whole-store swap + rollback restores the prior set', async () => {
    const s = store();
    await s.ingest([validRfiPack()]);                 // set 1
    expect((await s.tables())).toEqual(['rfi_ranges']);
    await s.ingest([modulesPack()]);                  // set 2 replaces set 1 (whole-store swap)
    expect((await s.tables())).toEqual(['learning_modules']);
    expect(await s.getAll('rfi_ranges')).toEqual([]);
    const ok = await s.rollback();                    // back to set 1
    expect(ok).toBe(true);
    expect((await s.tables())).toEqual(['rfi_ranges']);
    expect(await s.getAll('rfi_ranges')).toHaveLength(2);
  });

  it('find() returns clones (mutating a result does not corrupt the store)', async () => {
    const s = store();
    await s.ingest([validRfiPack()]);
    const hits = await s.find('rfi_ranges', { Position: 'CO' });
    hits[0].Hand = 'MUTATED';
    const again = await s.find('rfi_ranges', { RowID: hits[0].RowID });
    expect(again[0].Hand).not.toBe('MUTATED');
  });

  it('rollback returns false when there is no prior snapshot', async () => {
    const s = store();
    await s.ingest([validRfiPack()]);   // prior = initial empty
    expect(await s.rollback()).toBe(true);   // back to empty
    expect(await s.rollback()).toBe(false);  // nothing further to restore
  });

  it('keeps prior content when an ingest fully fails (no swap)', async () => {
    const s = store();
    await s.ingest([validRfiPack()]);
    const badOnly = makePack({ packId: 'p', sheet: 'X', schema: rfiSchema, rows: validRfiPack().rows, rowCountOverride: 0 });
    await s.ingest([badOnly]);
    expect((await s.tables())).toEqual(['rfi_ranges']); // unchanged
  });
});
