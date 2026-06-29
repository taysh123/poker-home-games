# T Poker Workbook Exporter (the D2 bridge)

Deterministic, dependency-free (Python stdlib) exporter that turns the canonical workbook
`content/release-0.8.1/TPoker_Content_Database.xlsx` (the **single source of truth**) into production JSON
artifacts per the in-workbook **Export_Contract**. No app logic; no fabrication — `VerificationTier` and labels
are copied verbatim; only `Published`/`Approved` rows are exported.

The canonical release path lives in **`paths.py`** (`RELEASE`) — the single place to bump on a version change;
`export.py`, `make_quiz_sample.py`, `make_analytics_contract.py`, and `audit_governance.py` all read it.

## Run
```
python tools/content-export/export.py            # all packs → exports/<dataset_version>/
python tools/content-export/make_quiz_sample.py  # bundled quiz sample → assets/content/<v>/
python tools/content-export/make_analytics_contract.py  # bundled analytics contract → assets/content/<v>/
python tools/content-export/audit_governance.py  # read-only enum-contradiction scan
```
Output (gitignored, reproducible) → `content/<release>/exports/<dataset_version>/`:
- `packs/<sheet>.pack.json` — one `{ manifest, schema, rows }` pack per source sheet (schema from `Schema_Registry`).
- `coach_grounding.json` — denormalized `Coach_Grounding` (incl. `assertion_template`, `safe_to_assert`).
- `pack_manifests.json` — `Pack_Manifests` rollups (verbatim).
- `index.json` — per-pack id / row_count / `content_hash` / `marketable_as` / error count.

## Hashing (R1 — resolved)
`canonical.py` computes `content_hash` (SHA-256 over the canonical sorted row body) **byte-identically** to the
app reader `apps/poker-mobile/src/content/hash.ts`. This is pinned by a cross-language fixture:
`make_fixture.py` → `apps/poker-mobile/src/content/__tests__/hashFixture.ts` → asserted in
`hashFixture.test.ts`. Regenerate the fixture if the canonicalization ever changes (and keep both sides in sync).

**Numeric-parity guarantee:** `js_number_str` is byte-identical to JS `String(Number)` only over the plain-decimal
range `|x| ∈ [1e-6, 1e21)` (where Python `repr` and V8 agree). Values outside it (exponential / sub-1e-6 /
≥1e21) make the exporter **raise** rather than emit a hash the app would reject — guaranteeing parity or loud
failure, never a silent mismatch. No 0.8.x value triggers this (frequencies/percentages/sizes are all in range).
`python tools/content-export/test_canonical.py` covers parity + the loud-failure boundary.

## Status (Release 0.8.1)
**57 packs generate; ALL PACKS VALID (0 validation errors).** Verified by `export.py`
(`total_validation_errors=0`) and `audit_governance.py` (0 enum contradictions).

### ✅ Governance contradiction RESOLVED in 0.8.1
The 12 sheets that failed enum validation under 0.8.0 (governance columns `ProductionReady` /
`SolverVerified` / `NeedsVerification` carrying values outside their own `Schema_Registry.AllowedValues` —
`Partial`, `Partial (…)`, `Yes (cross-ref)`) are **reconciled in 0.8.1**: Blind_vs_Blind, Facing_3Bet,
Facing_4Bet, IsoRaise, Squeeze, Flop_CBet, Turn_Strategy, River_Strategy, Coach_Knowledge_Map,
Learning_Modules, Premium_Content_Catalog, Source_Map now all validate. The full historical analysis is in
`docs/app-integration/workbook-governance-audit.md`. The exporter never loosened the contract or rewrote data —
remediation happened workbook-side, exactly as recommended.
