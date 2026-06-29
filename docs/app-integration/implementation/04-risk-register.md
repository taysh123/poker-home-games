# 04 — Risk Register (E)

Severity (S) × Likelihood (L), 1–5. Includes all verified review findings. Owner = the discipline that must
close it.

| # | Risk | S | L | Owner | Mitigation |
|---|------|---|---|-------|-----------|
| R1 | **content_hash recipe mismatch** → every pack quarantines | 5 | 4 | Data | One shared `hash.ts` used by fixture-gen + `validate.ts`; pin with a cross-language fixture; confirm the content team's canonicalization (column order, null/number/JSON) before real ingest. |
| R2 | **Jest globs exclude `src/content`/`src/analytics`** → false-green CI (verified) | 4 | 5 | QA | Add both globs in PR #1 + a trivial test proving they run. |
| R3 | **`solver_runs` hard-FK on a non-ingested table** | 4 | 4 | Data | `SolveConfigID` soft/warning; rule-4 = value-presence check, not DB FK. Vacuously safe (0 Solver-Verified). |
| R4 | **Rollback unimplementable** from flat meta + per-table rename; FK-referenced tables can't be dropped | 4 | 3 | Backend | Whole-content-store **staging swap** + retain prior store; rollback restores it. |
| R5 | **Coach ungrounded-claim leakage** | 5 | 2 | Coach | Single `grounding.ts` seam serves `SafeToAssert=Yes` only; property test over all 95 CG rows; always render `AssertionTemplate`. |
| R6 | **"GTO/Verified" mislabel below the 95% gate** | 5 | 2 | Product | `marketableLabel.ts` shows `MarketableAs` verbatim; snapshot truth table of all 17 packs; only Push/Fold (98.6%) qualifies. |
| R7 | **Analytics double-insert inflates mastery** | 4 | 3 | Data | `event_id` PK + `INSERT OR IGNORE`; mastery_* = recomputed projections from canonical facts. |
| R8 | **Flag OFF not byte-identical** (eager content import / native dep changes binary) | 4 | 3 | QA | Lazy bootstrap; no top-level side-effect imports on OFF path; boot test + dev-client/EAS check with `content:false`. |
| R9 | **Web parity / two query backends drift** (OD-1) | 3 | 3 | Frontend | Single `ContentBackend` interface + `queries.ts`; shared query tests run against both backends; memory cap on web (largest packs ~5k rows). |
| R10 | **expo-sqlite untestable under jest-expo** | 3 | 4 | QA | Inject `backend.ts`; in-memory backend = jest backend; native path via dev-client/Detox smoke. |
| R11 | **First-run jank / blocking init** (23k rows) | 2 | 3 | Frontend | Ingest off render path; one transaction/prepared stmts; `isLoaded` skeletons. |
| R12 | **Provider mis-order → silent default contexts** | 3 | 2 | Frontend | Pin Content/Mastery inside Entitlements, above Study/Coach; dev assertion. |
| R13 | **First published pack set not yet in repo** (D2) | 4 | 4 | Product | Build/test against STARTER_DATASET-derived fixture + large + broken packs until D2 lands; CI gate over the vendored set on arrival. |
| R14 | **Markdown renderer × web/reanimated** | 2 | 3 | Frontend | Spike `react-native-markdown-display` in the first lessons PR; theme via tokens; verify web. |
| R15 | **Composite PKs / array columns** mis-generated DDL | 2 | 3 | Backend | `schemaGen.ts` handles multi-column PK + array/object→`TEXT(JSON)` (excluded from scalar FK). |
| R16 | **Pack/bundle size in binary** | 2 | 3 | Platform | Bundle calibrated set only; server delivery later (D3); compress. |
| R17 | **Dataset version drift app↔packs** | 3 | 3 | Backend | Record `dataset_version`+hash; re-validate+re-ingest on bump; staging swap; rollback. |

## Open decisions (small, non-blocking)
- **OD-2** analytics vendor for `dispatch()` (adapter is neutral; defer). **OD-3** bundle layout / versioned asset
  path. Neither blocks PR #1.

## Honesty guardrails (must hold — see 05 for tests)
0% Solver-Verified preserved; `MarketableAs` verbatim + ≥95% gate (Push/Fold only); coach `SafeToAssert=Yes`
only; no app-side relabeling of verification.
