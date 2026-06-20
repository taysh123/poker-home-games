/**
 * In-memory ContentBackend (PR #2) — the web backend (OD-1) AND the jest test backend (no native SQLite
 * under jest-expo). Staging/commit/rollback use JSON-deep-copy snapshots, so the lifecycle semantics here
 * are the tested source of truth that the SQLite backend mirrors.
 */
import type { ContentBackend } from './backend';
import type { TableSpec, Row } from './types';

interface TableData { spec: TableSpec; rows: Row[] }
interface Snapshot { tables: Map<string, TableData>; meta: Map<string, string> }

const emptySnapshot = (): Snapshot => ({ tables: new Map(), meta: new Map() });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function cloneSnapshot(s: Snapshot): Snapshot {
  const tables = new Map<string, TableData>();
  for (const [k, v] of s.tables) tables.set(k, { spec: v.spec, rows: clone(v.rows) });
  return { tables, meta: new Map(s.meta) };
}

function matches(row: Row, where: Partial<Row>): boolean {
  for (const k of Object.keys(where)) if (row[k] !== where[k]) return false;
  return true;
}

export function createMemoryBackend(): ContentBackend {
  let live: Snapshot = emptySnapshot();
  let staging: Snapshot | null = null;
  let prior: Snapshot | null = null;

  const requireStaging = (): Snapshot => {
    if (!staging) throw new Error('memoryBackend: no staging in progress (call beginStaging first)');
    return staging;
  };

  return {
    async beginStaging() { staging = emptySnapshot(); },

    async defineTable(spec: TableSpec) {
      const s = requireStaging();
      s.tables.set(spec.table, { spec, rows: [] });
    },

    async insert(table: string, rows: Row[]) {
      const s = requireStaging();
      const t = s.tables.get(table);
      if (!t) throw new Error(`memoryBackend: insert into undefined table "${table}"`);
      for (const r of rows) t.rows.push(clone(r));
    },

    async commitStaging(meta?: Record<string, string>) {
      const next = requireStaging();
      if (meta) for (const [k, v] of Object.entries(meta)) next.meta.set(k, v);
      prior = live;            // retain previous for rollback
      live = next;
      staging = null;
    },

    async rollback() {
      if (!prior) return false;
      live = prior;
      prior = null;
      return true;
    },

    async getAll(table: string) {
      const t = live.tables.get(table);
      return t ? clone(t.rows) : [];
    },

    async getById(table: string, pk: Row) {
      const t = live.tables.get(table);
      if (!t) return null;
      const keys = t.spec.primaryKey;
      const where: Partial<Row> = {};
      for (const k of keys) where[k] = pk[k];
      const hit = t.rows.find(r => matches(r, where));
      return hit ? clone(hit) : null;
    },

    async find(table: string, where: Partial<Row>) {
      const t = live.tables.get(table);
      return t ? t.rows.filter(r => matches(r, where)).map(clone) : [];
    },

    async tables() { return [...live.tables.keys()]; },

    async setMeta(key: string, value: string) { live.meta.set(key, value); },
    async getMeta(key: string) { return live.meta.has(key) ? live.meta.get(key)! : null; },
  };
}
