import { tableSpec, inferPrimaryKey, createTableSql } from '../schemaGen';
import { validRfiPack, compositePack, lessonsPack } from './fixtures';
import type { SchemaColumn } from '../types';

describe('inferPrimaryKey', () => {
  it('prefers RowID, then *ID, then first column', () => {
    expect(inferPrimaryKey([{ column: 'RowID', datatype: 'string' }, { column: 'X', datatype: 'string' }])).toEqual(['RowID']);
    expect(inferPrimaryKey([{ column: 'A', datatype: 'string' }, { column: 'SpotID', datatype: 'string' }])).toEqual(['SpotID']);
    expect(inferPrimaryKey([{ column: 'A', datatype: 'string' }, { column: 'B', datatype: 'string' }])).toEqual(['A']);
  });
});

describe('tableSpec', () => {
  it('snake_cases the sheet, maps types, enums→check, required', () => {
    const spec = tableSpec(validRfiPack());
    expect(spec.table).toBe('rfi_ranges');
    expect(spec.primaryKey).toEqual(['RowID']);
    const freq = spec.columns.find(c => c.name === 'Frequency')!;
    expect(freq.type).toBe('REAL');
    expect(freq.required).toBe(true);
    const pos = spec.columns.find(c => c.name === 'Position')!;
    expect(pos.check).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  });
  it('honors explicit composite PK and maps array→TEXT(JSON)', () => {
    const spec = tableSpec(compositePack());
    expect(spec.primaryKey).toEqual(['PackID', 'ModuleID']);
    expect(spec.columns.find(c => c.name === 'Tags')!.type).toBe('TEXT');
  });
  it('captures hard FKs and excludes soft (node) links', () => {
    const spec = tableSpec(lessonsPack());
    expect(spec.hardForeignKeys).toEqual([{ column: 'ModuleID', refTable: 'learning_modules', refColumn: 'ModuleID' }]);
    const rfi = tableSpec(validRfiPack());
    expect(rfi.hardForeignKeys).toHaveLength(0); // LinkedLessonID is '(node)' soft
  });
});

describe('createTableSql', () => {
  it('renders PK, CHECK and FOREIGN KEY', () => {
    const sql = createTableSql(tableSpec(lessonsPack()));
    expect(sql).toContain('CREATE TABLE "lesson_content"');
    expect(sql).toContain('PRIMARY KEY ("LessonContentID")');
    expect(sql).toContain('FOREIGN KEY ("ModuleID") REFERENCES "learning_modules"("ModuleID")');
    const enumSql = createTableSql(tableSpec(validRfiPack()));
    expect(enumSql).toContain('CHECK("Position" IN (');
  });
});
