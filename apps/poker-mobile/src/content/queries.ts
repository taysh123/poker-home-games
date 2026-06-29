/**
 * Content read API (PR #2) — thin, typed wrappers over a ContentStore. Foundation for future consumers
 * (lessons/quizzes/ranges/etc. in later PRs); intentionally minimal here.
 */
import type { ContentStore } from './contentStore';
import type { Row } from './types';

export function createQueries(store: ContentStore) {
  return {
    all: (table: string): Promise<Row[]> => store.getAll(table),
    byId: (table: string, pk: Row): Promise<Row | null> => store.getById(table, pk),
    find: (table: string, where: Partial<Row>): Promise<Row[]> => store.find(table, where),
    tables: (): Promise<string[]> => store.tables(),
  };
}

export type ContentQueries = ReturnType<typeof createQueries>;
