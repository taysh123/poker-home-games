/**
 * Schema-driven table generation (PR #2) — PURE. Turns a pack's `schema` block into a `TableSpec`
 * (datatype→column type, enum→CHECK, hard fk→FOREIGN KEY, composite PK). The SQLite backend renders
 * this to DDL; the in-memory backend uses it for indexes/validation. The app never hardcodes columns.
 */
import {
  type ContentPack, type SchemaColumn, type TableSpec, type TableColumn, type ForeignKey,
  isRequired, parseHardFk, tableNameFor,
} from './types';

function columnType(datatype: SchemaColumn['datatype']): TableColumn['type'] {
  switch (datatype) {
    case 'number': return 'REAL';
    case 'int':
    case 'bool': return 'INTEGER';
    default: return 'TEXT'; // string | date | object(JSON) | array(JSON)
  }
}

/** Infer a single PK when the pack doesn't declare one: RowID → *ID → first column. */
export function inferPrimaryKey(schema: SchemaColumn[]): string[] {
  const names = schema.map(c => c.column);
  if (names.includes('RowID')) return ['RowID'];
  const idCol = names.find(n => /ID$/.test(n));
  if (idCol) return [idCol];
  return names.length ? [names[0]] : [];
}

export function tableSpec(pack: ContentPack): TableSpec {
  const columns: TableColumn[] = pack.schema.map(c => ({
    name: c.column,
    type: columnType(c.datatype),
    sourceType: c.datatype,
    check: c.allowed && c.allowed.length ? c.allowed : undefined,
    required: isRequired(c),
  }));
  const hardForeignKeys: ForeignKey[] = [];
  for (const c of pack.schema) {
    const fk = parseHardFk(c.fk);
    if (fk) hardForeignKeys.push({ column: c.column, refTable: tableNameFor(fk.sheet), refColumn: fk.column });
  }
  return {
    table: tableNameFor(pack.manifest.source_sheet),
    columns,
    primaryKey: pack.primaryKey && pack.primaryKey.length ? pack.primaryKey : inferPrimaryKey(pack.schema),
    hardForeignKeys,
  };
}

/** Render a TableSpec to CREATE TABLE DDL (used by the SQLite backend). PURE/testable. */
export function createTableSql(spec: TableSpec): string {
  const cols = spec.columns.map(c => {
    let def = `"${c.name}" ${c.type}`;
    if (c.required) def += ' NOT NULL';
    if (c.check && c.check.length) def += ` CHECK("${c.name}" IN (${c.check.map(v => `'${v.replace(/'/g, "''")}'`).join(', ')}))`;
    return def;
  });
  if (spec.primaryKey.length) cols.push(`PRIMARY KEY (${spec.primaryKey.map(c => `"${c}"`).join(', ')})`);
  for (const fk of spec.hardForeignKeys) {
    cols.push(`FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}"("${fk.refColumn}")`);
  }
  return `CREATE TABLE "${spec.table}" (\n  ${cols.join(',\n  ')}\n)`;
}
