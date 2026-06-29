/**
 * ContentStore types (PR #2) — the on-device shape of the workbook's export contract
 * ({ manifest, schema, rows }) and the store's internal table/validation/ingest types.
 * Schema-driven: tables are generated from each pack's `schema` block, never hardcoded.
 * No content is bundled or imported here — this is infrastructure only (flag-gated, OFF in prod).
 */

export type ColumnType = 'string' | 'number' | 'int' | 'bool' | 'date' | 'object' | 'array';

/** One column contract, mirroring the workbook `Schema_Registry` row shape. */
export interface SchemaColumn {
  column: string;
  datatype: ColumnType;
  /** Enum membership → CHECK. */
  allowed?: string[] | null;
  /** Workbook emits 'Y'/'N'; we also accept boolean. Normalize with `isRequired`. */
  required?: boolean | 'Y' | 'N';
  /** 'Sheet.Column' = hard FK; '(node)' = soft/polymorphic (warning only); null/undefined = none. */
  fk?: string | null;
}

export interface PackManifest {
  dataset_version: string;
  pack_id: string;
  /** Single source sheet per pack → one table named snake_case(source_sheet). */
  source_sheet: string;
  exported?: string;
  row_count: number;
  /** SHA-256 hex over the canonical sorted row body (integrity). */
  content_hash: string;
  verification_rollup?: Record<string, number>;
  marketable_as?: string;
}

export type Row = Record<string, unknown>;

export interface ContentPack {
  manifest: PackManifest;
  schema: SchemaColumn[];
  rows: Row[];
  /** Explicit PK columns (supports composite PKs, e.g. content_packs = [PackID, ModuleID]).
   *  When absent, the store infers a single PK (see `inferPrimaryKey`). */
  primaryKey?: string[];
}

/** Generated SQLite-shaped table contract (also drives the in-memory backend's indexes). */
export interface TableSpec {
  table: string;
  columns: TableColumn[];
  primaryKey: string[];
  hardForeignKeys: ForeignKey[];
}
export interface TableColumn {
  name: string;
  type: 'TEXT' | 'REAL' | 'INTEGER';
  /** Original workbook datatype — lets the SQLite backend decode bool/JSON back to JS types on read. */
  sourceType: ColumnType;
  check?: string[]; // allowed values (enum)
  required: boolean;
}
export interface ForeignKey { column: string; refTable: string; refColumn: string }

export interface ValidationReport { ok: boolean; errors: string[]; warnings: string[] }

export interface IngestResult {
  ok: boolean;
  packId: string;
  table: string;
  rows: number;
  errors: string[];
  warnings: string[];
  quarantined: boolean;
}

/** True when a column is required ('Y' or boolean true). */
export function isRequired(col: SchemaColumn): boolean {
  return col.required === true || col.required === 'Y';
}

/** A hard FK ('Sheet.Column'); soft '(node)' and empty return null. */
export function parseHardFk(fk?: string | null): { sheet: string; column: string } | null {
  if (!fk || fk === '(node)') return null;
  const m = /^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)$/.exec(fk);
  return m ? { sheet: m[1], column: m[2] } : null;
}

/** snake_case a workbook sheet name (e.g. 'RFI_Ranges' -> 'rfi_ranges'). */
export function tableNameFor(sheet: string): string {
  return sheet.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
}
