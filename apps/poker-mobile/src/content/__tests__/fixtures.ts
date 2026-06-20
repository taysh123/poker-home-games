/** Synthetic content packs for PR #2 tests (NOT workbook content). Hashes computed via the real hash.ts. */
import { type ContentPack, type SchemaColumn, type Row } from '../types';
import { contentHash } from '../hash';

export function makePack(opts: {
  packId?: string;
  sheet?: string;
  dsv?: string;
  schema: SchemaColumn[];
  rows: Row[];
  primaryKey?: string[];
  hashOverride?: string;
  rowCountOverride?: number;
}): ContentPack {
  const { schema, rows } = opts;
  return {
    manifest: {
      dataset_version: opts.dsv ?? '0.8.0',
      pack_id: opts.packId ?? 'pack.test',
      source_sheet: opts.sheet ?? 'Test_Sheet',
      row_count: opts.rowCountOverride ?? rows.length,
      content_hash: opts.hashOverride ?? contentHash({ rows, schema }),
    },
    schema,
    rows,
    primaryKey: opts.primaryKey,
  };
}

// A realistic strategy-style pack (enum tier/status, RowID PK, soft Linked* + hard provenance FK omitted for unit scope).
export const rfiSchema: SchemaColumn[] = [
  { column: 'RowID', datatype: 'string', required: 'Y' },
  { column: 'Position', datatype: 'string', required: 'Y', allowed: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] },
  { column: 'Hand', datatype: 'string', required: 'Y' },
  { column: 'Frequency', datatype: 'number', required: 'Y' },
  { column: 'VerificationTier', datatype: 'string', required: 'Y', allowed: ['Calibrated', 'Nash-Solved', 'Solver-Verified', 'Educational'] },
  { column: 'SolveConfigID', datatype: 'string', required: 'N' },
  { column: 'Status', datatype: 'string', required: 'Y', allowed: ['Draft', 'In-Review', 'Approved', 'Published', 'Deprecated'] },
  { column: 'LinkedLessonID', datatype: 'string', required: 'N', fk: '(node)' },
];

export const rfiRows: Row[] = [
  { RowID: 'RFI-0001', Position: 'CO', Hand: 'AKs', Frequency: 100, VerificationTier: 'Calibrated', SolveConfigID: null, Status: 'Approved', LinkedLessonID: 'LC-0001' },
  { RowID: 'RFI-0002', Position: 'CO', Hand: 'T9s', Frequency: 60, VerificationTier: 'Calibrated', SolveConfigID: null, Status: 'Published', LinkedLessonID: null },
];

export const validRfiPack = (): ContentPack => makePack({ packId: 'pack.rfi', sheet: 'RFI_Ranges', schema: rfiSchema, rows: rfiRows });

// Curriculum: modules + lessons with a HARD FK lessons.ModuleID -> Learning_Modules.ModuleID (resolved at store level).
export const modulesSchema: SchemaColumn[] = [
  { column: 'ModuleID', datatype: 'string', required: 'Y' },
  { column: 'ModuleName', datatype: 'string', required: 'Y' },
];
export const lessonsSchema: SchemaColumn[] = [
  { column: 'LessonContentID', datatype: 'string', required: 'Y' },
  { column: 'ModuleID', datatype: 'string', required: 'Y', fk: 'Learning_Modules.ModuleID' },
  { column: 'SectionOrder', datatype: 'int', required: 'Y' },
  { column: 'BodyText', datatype: 'string', required: 'Y' },
];
export const modulesPack = (): ContentPack => makePack({
  packId: 'pack.modules', sheet: 'Learning_Modules', schema: modulesSchema,
  rows: [{ ModuleID: 'LM-01', ModuleName: 'Preflop Opens' }],
});
export const lessonsPack = (moduleId = 'LM-01'): ContentPack => makePack({
  packId: 'pack.lessons', sheet: 'Lesson_Content', schema: lessonsSchema,
  rows: [{ LessonContentID: 'LC-0001', ModuleID: moduleId, SectionOrder: 1, BodyText: '# Hi' }],
});

// Composite-PK + JSON(array) column pack.
export const compositePack = (): ContentPack => makePack({
  packId: 'pack.composite', sheet: 'Content_Packs', schema: [
    { column: 'PackID', datatype: 'string', required: 'Y' },
    { column: 'ModuleID', datatype: 'string', required: 'Y' },
    { column: 'Tags', datatype: 'array', required: 'N' },
  ],
  rows: [{ PackID: 'PACK-01', ModuleID: 'LM-01', Tags: ['core', 'cash'] }],
  primaryKey: ['PackID', 'ModuleID'],
});
