/**
 * ContentStore (PR #2) — orchestrates ingest of a full published pack set into a backend:
 * per-pack validate → cross-set hard-FK resolution → whole-store staging swap (atomic) → commit,
 * quarantining any invalid/dangling pack and keeping the prior good set on total failure. Writes are
 * serialized (write-queue). Backend-injected (in-memory for web/tests, expo-sqlite on native).
 */
import type { ContentBackend } from './backend';
import { validate } from './validate';
import { tableSpec } from './schemaGen';
import { type ContentPack, type IngestResult, type Row, type TableSpec, tableNameFor, parseHardFk } from './types';

export interface QuarantineEntry { packId: string; reason: 'validation' | 'foreign_key'; errors: string[] }

export interface ContentStore {
  /** Ingest a FULL set (whole-store swap). Valid packs commit; invalid/dangling ones quarantine. */
  ingest(packs: ContentPack[]): Promise<IngestResult[]>;
  rollback(): Promise<boolean>;
  datasetVersion(): Promise<string | null>;
  getAll(table: string): Promise<Row[]>;
  getById(table: string, pk: Row): Promise<Row | null>;
  find(table: string, where: Partial<Row>): Promise<Row[]>;
  tables(): Promise<string[]>;
  quarantine(): QuarantineEntry[];
}

interface Valid { pack: ContentPack; spec: TableSpec; warnings: string[] }

/** Cross-set hard-FK check for one pack. Returns error strings ([] = resolves). */
function resolveFks(pack: ContentPack, spec: TableSpec, all: Valid[]): string[] {
  const errors: string[] = [];
  for (const fk of spec.hardForeignKeys) {
    const refTableRows = fk.refTable === spec.table
      ? pack.rows
      : all.find(v => v.spec.table === fk.refTable)?.pack.rows;
    if (refTableRows === undefined) {
      // Referenced table not in this set. Only an error if any non-null FK value exists.
      const used = pack.rows.some(r => r[fk.column] !== null && r[fk.column] !== undefined && r[fk.column] !== '');
      if (used) errors.push(`hard FK "${fk.column}" → missing table "${fk.refTable}"`);
      continue;
    }
    const targets = new Set(refTableRows.map(r => String(r[fk.refColumn])));
    for (const r of pack.rows) {
      const v = r[fk.column];
      if (v === null || v === undefined || v === '') continue;
      if (!targets.has(String(v))) errors.push(`hard FK "${fk.column}"="${String(v)}" → not found in ${fk.refTable}.${fk.refColumn}`);
    }
  }
  return errors;
}

export function createContentStore(backend: ContentBackend): ContentStore {
  let queue: Promise<unknown> = Promise.resolve();
  let quarantined: QuarantineEntry[] = [];

  const serialize = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.then(() => undefined, () => undefined);
    return run;
  };

  async function doIngest(packs: ContentPack[]): Promise<IngestResult[]> {
    quarantined = [];
    const results: IngestResult[] = [];

    // Pass 1 — per-pack validation.
    let valid: Valid[] = [];
    for (const pack of packs) {
      const report = validate(pack);
      const table = tableNameFor(pack.manifest.source_sheet);
      if (!report.ok) {
        quarantined.push({ packId: pack.manifest.pack_id, reason: 'validation', errors: report.errors });
        results.push({ ok: false, packId: pack.manifest.pack_id, table, rows: pack.rows.length, errors: report.errors, warnings: report.warnings, quarantined: true });
      } else {
        valid.push({ pack, spec: tableSpec(pack), warnings: report.warnings });
      }
    }

    // Pass 2 — hard-FK resolution across the valid set (cascade: removing a pack may dangle dependents).
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = valid.length - 1; i >= 0; i--) {
        const fkErrors = resolveFks(valid[i].pack, valid[i].spec, valid);
        if (fkErrors.length) {
          const v = valid[i];
          quarantined.push({ packId: v.pack.manifest.pack_id, reason: 'foreign_key', errors: fkErrors });
          results.push({ ok: false, packId: v.pack.manifest.pack_id, table: v.spec.table, rows: v.pack.rows.length, errors: fkErrors, warnings: [], quarantined: true });
          valid.splice(i, 1);
          changed = true;
        }
      }
    }

    // Pass 3 — whole-store staging swap. Nothing valid ⇒ keep prior live (no swap).
    // Note: define/insert order follows pack order. Backends omit FK *constraints* (integrity is enforced
    // above by resolveFks), so no topological ordering is required; a constraint-enforcing backend would.
    if (valid.length === 0) return results;
    await backend.beginStaging();
    for (const { spec } of valid) await backend.defineTable(spec);
    for (const { pack, spec } of valid) await backend.insert(spec.table, pack.rows);
    await backend.commitStaging({ dataset_version: valid[0].pack.manifest.dataset_version });

    for (const { pack, spec, warnings } of valid) {
      results.push({ ok: true, packId: pack.manifest.pack_id, table: spec.table, rows: pack.rows.length, errors: [], warnings, quarantined: false });
    }
    return results;
  }

  return {
    ingest: (packs) => serialize(() => doIngest(packs)),
    rollback: () => serialize(() => backend.rollback()),
    datasetVersion: () => backend.getMeta('dataset_version'),
    getAll: (table) => backend.getAll(table),
    getById: (table, pk) => backend.getById(table, pk),
    find: (table, where) => backend.find(table, where),
    tables: () => backend.tables(),
    quarantine: () => quarantined.slice(),
  };
}
