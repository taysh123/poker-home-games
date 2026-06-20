# 05 — ContentStore Design (D)

Production design of the module that owns content ingest + query. It is the **single** content boundary for all
consumers (lessons, trainer, quizzes, postflop, coach, packs, leaks). Mirrors the proven versioned-store +
quarantine + write-queue pattern (`src/local/localGamesStore.ts`).

---

## 1. Responsibilities & boundaries
- **Owns:** the content SQLite DB, ingest/validation, version state, and typed read queries.
- **Does NOT own:** user data (telemetry/mastery — separate `user.db`), networking policy, or UI. It exposes
  data; consumers render. It never reads the `.xlsx` and never generates exports (D2).

## 2. Interfaces (lifecycle verbs)
```ts
interface ContentStore {
  // bootstrap / lifecycle
  init(): Promise<void>;                                   // open DB, ensure meta, run pending migration
  ingestPack(pack: Pack, opts?: {source:'bundle'|'server'}): Promise<IngestResult>;
  ingestBundleSet(): Promise<IngestSummary>;               // first-run / on dataset bump
  // version / integrity
  datasetVersion(): string | null;
  isStale(latest: string): boolean;                        // compare ingested vs available semver
  rollback(toVersion: string): Promise<void>;              // restore previous good content snapshot
  // query (typed, read-only)
  query: ContentQueries;                                   // see §5
  status(packId: string): 'ingested'|'quarantined'|'absent';
}
interface Validator { validate(pack: Pack): ValidationReport; }   // pure (06 rules)
interface IngestResult { ok: boolean; pack_id: string; rows: number; warnings: string[]; errors: string[]; }
```

## 3. Sub-components
| Component | Responsibility |
|---|---|
| `validate.ts` (pure) | The 5 validation rules (06); returns errors (block) + warnings (soft FK). No I/O. |
| `schemaGen.ts` (pure) | `schema[]` → `CREATE TABLE` DDL (04 generation rule). No I/O. |
| `db.ts` | expo-sqlite adapter: open `content.db`/`user.db`, exec DDL, parameterized inserts, transactions, WAL. |
| `contentStore.ts` | Orchestrates ingest → validate → DDL → bulk insert → swap → record meta; quarantine on fail; write-queue serialization. |
| `queries.ts` | Typed read API for consumers (§5). |
| `migrate.ts` | Schema-version migration chain (mirrors `migrateToCurrent`). |

## 4. Ingest lifecycle (per pack — transactional)
```
parse JSON
  → validate(pack)                      // pure; errors => quarantine + keep prior; warnings logged
  → BEGIN TRANSACTION
      → CREATE TABLE tmp_<sheet> from schema  (CHECK/FK)
      → bulk INSERT rows (parameterized)
      → integrity: row_count == manifest.row_count; hash(rows)==manifest.content_hash; hard FKs resolve
      → DROP <sheet>; ALTER tmp_<sheet> RENAME TO <sheet>     // atomic swap
    → COMMIT  (on any error: ROLLBACK → quarantine_log → previous table stays)
  → upsert ingested_packs + content_meta(dataset_version, content_hash)
```
- **Atomicity:** a failed pack never replaces a good one (the live table is swapped only after full validation +
  insert succeed).
- **Serialization:** all writes go through a single write-queue (no interleaving), as in `LocalGamesContext`.

## 5. Query surface (read-only, typed) — what consumers call
| Consumer | Query |
|---|---|
| Lessons | `query.lessonSections(moduleId)` → ordered `lesson_content` (SectionOrder); `query.modules()/tracks()/paths()` |
| Trainer/Ranges | `query.range(sheet, filter)`; `query.rangeGrid(spotId)` (13×13); reuses `buildTrainerHand`/`evaluateSpot` |
| Postflop | `query.node(nodeId)`, `query.nodeActions(nodeId)`, `query.sizingSet(id)` |
| Quizzes | `query.quiz(quizId)`, `query.collection(criteria)`, `query.objectives(moduleId)` |
| Coach | `query.grounding({conceptId, safeOnly:true})` → `safe_to_assert=1` only; `query.concept(id)` |
| Packs/gating | `query.packManifest(packId)`, `query.access(assetName)` |
| Leaks | `query.leaks()`, `query.remediation(leakId)` |
Every query is read-only against the post-ingest content DB; user data lives in `user.db` (04).

## 6. State machine
`uninitialized → init() → ready` ; on bundle/bump: `ready → ingesting → (ready | degraded)` where `degraded` =
some packs quarantined but prior/bundled good versions still serve (06 recovery). `rollback()` returns to a
prior `ready` snapshot.

## 7. Concurrency, performance, footprint
- Bulk inserts batched in one transaction per pack; WAL mode; prepared statements.
- Largest tables: `range_viewer_database` (5,239), `pushfold_ranges` (2,967), `quiz_catalog` (2,488),
  `icm_decisions` (1,620) — all comfortable for SQLite; validate-once-at-ingest (not per read).
- Content DB is replaceable; `user.db` is durable and never dropped on content upgrade.
