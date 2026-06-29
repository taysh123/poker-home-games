/**
 * ContentBackend (PR #2) — the storage abstraction shared by the native (expo-sqlite) and web/test
 * (in-memory) implementations, so the ContentStore + queries are backend-agnostic. A *data* API (not
 * SQL strings) so the in-memory backend can implement it fully and double as the jest test backend.
 *
 * Lifecycle: beginStaging → defineTable + insert → commitStaging (atomic swap, retains prior) → rollback.
 * Reads operate on the committed ("live") content set only.
 */
import type { TableSpec, Row } from './types';

export interface ContentBackend {
  /** Start a fresh staging content set (does not affect the live set until commit). */
  beginStaging(): Promise<void>;
  defineTable(spec: TableSpec): Promise<void>;
  insert(table: string, rows: Row[]): Promise<void>;
  /** Atomically promote staging → live, retaining the previous live set for rollback. Optional meta merged in. */
  commitStaging(meta?: Record<string, string>): Promise<void>;
  /** Restore the previously committed live set. Returns false if there is no prior snapshot. */
  rollback(): Promise<boolean>;

  getAll(table: string): Promise<Row[]>;
  getById(table: string, pk: Row): Promise<Row | null>;
  find(table: string, where: Partial<Row>): Promise<Row[]>;
  tables(): Promise<string[]>;

  setMeta(key: string, value: string): Promise<void>;
  getMeta(key: string): Promise<string | null>;
}
