# 01 — Phase 0 Architecture (A)

The foundation that lets the app consume Release 0.8.0 content safely, offline-first, with honest verification
and gating. Ten foundation items, one coherent architecture.

---

## 1. Boundaries (who owns what)
- **Workbook (content team):** canonical content + governance. Runs the exporter (D2). Stores **no** user data.
- **Published packs (artifact boundary):** versioned JSON packs + `TPoker_coach_grounding.json` (03). The app's
  **only** input. The app never reads the `.xlsx` or runs the exporter.
- **App (this design):** ingests packs into **expo-sqlite** (D1), renders content, **emits** the analytics
  contract, computes mastery, and owns **all** user data + telemetry + mastery state.

## 2. Data flow

```
 content team (D2)            artifact boundary                 app device (D1, D3)
 ┌───────────────┐  publish   ┌──────────────────────┐  bundle/  ┌───────────────────────────────────────┐
 │ workbook .xlsx│ ─────────► │ versioned pack set    │  download │ ContentStore                          │
 │  + exporter   │            │  *.pack.json          │ ────────► │  ingest→validate→store→query (sqlite) │
 └───────────────┘            │  coach_grounding.json │           │   content tables (read-only replicas) │
                              │  index.json (later)   │           │   app-owned tables (user data)        │
                              └──────────────────────┘            │                                       │
                                                                  │ consumers: Lessons · Trainer/Ranges · │
                                                                  │  Quizzes · Postflop tree · Coach ·    │
                                                                  │  Packs/gating · Leak finder           │
                                                                  │ AnalyticsEmitter → 11 events (D5)     │
                                                                  │ MasteryEngine (MM-01..05)             │
                                                                  └───────────────────────────────────────┘
```

## 3. The ten foundation items (at a glance)
| # | Item | Essence | Doc |
|---|------|---------|-----|
| 1 | Export artifact inventory | One pack per export-set; coach JSON; meta. Every artifact fully specified. | 02 |
| 2 | JSON artifact specs | `manifest + schema + rows` envelope; coach grounding JSON. | 03 |
| 3 | SQLite schema | Schema-driven content tables + app-owned user/telemetry/mastery/meta tables. | 04 |
| 4 | ContentStore | ingest/validate/store/query/cache/version/migrate/rollback. | 05 |
| 5 | Pack ingestion | Parse → validate → transactional swap → record version. | 05 |
| 6 | Validation | enum · required · FK · `Solver-Verified⇒SolveConfigID` · hash. | 05 |
| 7 | Upgrade/versioning | semver + content_hash; re-ingest on bump; rollback. | 06 |
| 8 | Bootstrap | First-run bundled ingest; subsequent integrity check. | 06 |
| 9 | Failure/recovery | Quarantine corrupt; keep prior/bundled good version. | 06 |
| 10 | Offline-first | Bundled set always present; cached packs; no network needed. | 06 |

## 4. Principles (inherited, non-negotiable)
- **Schema-driven, not hardcoded.** Content tables are generated from each pack's `schema` block (from the
  workbook `Schema_Registry`), so the app never drifts from the contract.
- **Additive + flag-gated + reversible.** All Phase 0 work sits behind a `content` flag; OFF = today's app.
- **Fail-closed + never destroy data.** Unknown gating → no access; corrupt pack → quarantine, not clobber.
- **Honest verification.** Show `marketable_as` verbatim; 0% Solver-Verified today; GTO gate BLOCK except
  Push/Fold. No claim served as fact unless `SafeToAssert=Yes`.
- **Workbook is source of truth.** The app is a consumer + emitter; it owns only user data.
