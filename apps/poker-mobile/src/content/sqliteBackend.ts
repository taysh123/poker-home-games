/**
 * SQLite ContentBackend (PR #2) — native (iOS/Android) implementation via expo-sqlite, mirroring the
 * in-memory backend's lifecycle. **Device-verification pending** (expo-sqlite's native module can't run
 * under jest-expo; the in-memory backend is the tested source of truth for these semantics).
 *
 * Design: the DB is a read replica — **hard-FK integrity is enforced at ingest by the ContentStore**
 * (resolveFks), so generated tables carry PK + CHECK only (no FK constraints). That keeps the whole-store
 * staging swap simple and sidesteps the connection-scoped `PRAGMA foreign_keys` / FK-referenced-drop issues.
 * Swap: build `stg__*` tables → on commit, rename live `<t>`→`prev__<t>` and `stg__<t>`→`<t>` in one
 * transaction; rollback restores the `prev__*` set.
 */
import * as SQLite from 'expo-sqlite';
import type { ContentBackend } from './backend';
import type { TableSpec, Row } from './types';

const DB_NAME = 'tpoker_content.db';
const META = '_content_meta';

function colType(t: TableSpec['columns'][number]['type']): string { return t; }

function createTableSqlNoFk(spec: TableSpec, name: string): string {
  const cols = spec.columns.map(c => {
    let def = `"${c.name}" ${colType(c.type)}`;
    if (c.required) def += ' NOT NULL';
    if (c.check && c.check.length) def += ` CHECK("${c.name}" IN (${c.check.map(v => `'${v.replace(/'/g, "''")}'`).join(', ')}))`;
    return def;
  });
  if (spec.primaryKey.length) cols.push(`PRIMARY KEY (${spec.primaryKey.map(c => `"${c}"`).join(', ')})`);
  return `CREATE TABLE "${name}" (\n  ${cols.join(',\n  ')}\n)`;
}

function encode(v: unknown): SQLite.SQLiteBindValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') return JSON.stringify(v);
  return v as SQLite.SQLiteBindValue;
}

/** Symmetric to encode(): restore JS types (bool, object/array JSON) on read so native rows match the
 *  in-memory backend. Uses the in-session spec cache; without it (e.g. before any ingest after a cold
 *  start) rows are returned raw — spec persistence across restarts is a later-PR follow-up. */
function decodeRow(spec: TableSpec | undefined, row: Row): Row {
  if (!spec) return row;
  const out: Row = { ...row };
  for (const c of spec.columns) {
    const v = out[c.name];
    if (v === null || v === undefined) continue;
    if (c.sourceType === 'bool') out[c.name] = v === 1 || v === '1' || v === true;
    else if ((c.sourceType === 'object' || c.sourceType === 'array') && typeof v === 'string') {
      try { out[c.name] = JSON.parse(v); } catch { /* leave raw */ }
    }
  }
  return out;
}

export async function createSqliteBackend(): Promise<ContentBackend> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS "${META}" (k TEXT PRIMARY KEY, v TEXT)`);
  const specs = new Map<string, TableSpec>();        // in-session spec cache (for PK lookups)

  const namesWith = async (prefix: string): Promise<string[]> => {
    const rows = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? AND name NOT LIKE 'sqlite_%'`,
      [`${prefix}%`],
    );
    return rows.map(r => r.name);
  };
  const liveTables = async (): Promise<string[]> =>
    (await namesWith('')).filter(n => n !== META && !n.startsWith('stg__') && !n.startsWith('prev__'));
  // Reads on an absent table return empty (parity with the in-memory backend) rather than throwing
  // a SQLite "no such table" — so a flag-ON / no-ingest state surfaces as an honest empty state.
  const hasTable = async (table: string): Promise<boolean> => (await liveTables()).includes(table);

  return {
    async beginStaging() {
      for (const t of await namesWith('stg__')) await db.execAsync(`DROP TABLE "${t}"`);
    },
    async defineTable(spec: TableSpec) {
      specs.set(spec.table, spec);
      await db.execAsync(createTableSqlNoFk(spec, `stg__${spec.table}`));
    },
    async insert(table: string, rows: Row[]) {
      const spec = specs.get(table);
      if (!spec) throw new Error(`sqliteBackend: insert into undefined table "${table}"`);
      const cols = spec.columns.map(c => c.name);
      const placeholders = cols.map(() => '?').join(', ');
      const sql = `INSERT INTO "stg__${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
      const stmt = await db.prepareAsync(sql);
      try {
        for (const r of rows) await stmt.executeAsync(cols.map(c => encode(r[c])));
      } finally {
        await stmt.finalizeAsync();
      }
    },
    async commitStaging(meta?: Record<string, string>) {
      await db.withTransactionAsync(async () => {
        for (const t of await namesWith('prev__')) await db.execAsync(`DROP TABLE "${t}"`);
        for (const t of await liveTables()) await db.execAsync(`ALTER TABLE "${t}" RENAME TO "prev__${t}"`);
        for (const s of await namesWith('stg__')) await db.execAsync(`ALTER TABLE "${s}" RENAME TO "${s.slice(5)}"`);
        if (meta) for (const [k, v] of Object.entries(meta)) {
          await db.runAsync(`INSERT INTO "${META}"(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, [k, v]);
        }
      });
    },
    async rollback() {
      const prev = await namesWith('prev__');
      if (prev.length === 0) return false;
      await db.withTransactionAsync(async () => {
        for (const t of await liveTables()) await db.execAsync(`DROP TABLE "${t}"`);
        for (const p of prev) await db.execAsync(`ALTER TABLE "${p}" RENAME TO "${p.slice(6)}"`);
      });
      return true;
    },
    async getAll(table: string) {
      if (!(await hasTable(table))) return [];
      const rows = await db.getAllAsync<Row>(`SELECT * FROM "${table}"`);
      return rows.map(r => decodeRow(specs.get(table), r));
    },
    async getById(table: string, pk: Row) {
      if (!(await hasTable(table))) return null;
      const spec = specs.get(table);
      const keys = spec?.primaryKey ?? Object.keys(pk);
      const where = keys.map(k => `"${k}" = ?`).join(' AND ');
      const row = await db.getFirstAsync<Row>(`SELECT * FROM "${table}" WHERE ${where}`, keys.map(k => encode(pk[k])));
      return row ? decodeRow(spec, row) : null;
    },
    async find(table: string, where: Partial<Row>) {
      if (!(await hasTable(table))) return [];
      const keys = Object.keys(where);
      const spec = specs.get(table);
      const sql = keys.length === 0
        ? `SELECT * FROM "${table}"`
        : `SELECT * FROM "${table}" WHERE ${keys.map(k => `"${k}" = ?`).join(' AND ')}`;
      const rows = await db.getAllAsync<Row>(sql, keys.map(k => encode((where as Row)[k])));
      return rows.map(r => decodeRow(spec, r));
    },
    async tables() { return liveTables(); },
    async setMeta(key: string, value: string) {
      await db.runAsync(`INSERT INTO "${META}"(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, [key, value]);
    },
    async getMeta(key: string) {
      const row = await db.getFirstAsync<{ v: string }>(`SELECT v FROM "${META}" WHERE k = ?`, [key]);
      return row ? row.v : null;
    },
  };
}
