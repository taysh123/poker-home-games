# T Poker Workbook Exporter (the D2 bridge)

Deterministic, dependency-free (Python stdlib) exporter that turns the signed-off workbook
`content/release-0.8.0/TPoker_Content_Database.xlsx` (the **single source of truth**) into production JSON
artifacts per the in-workbook **Export_Contract**. No app logic; no fabrication — `VerificationTier` and labels
are copied verbatim; only `Published`/`Approved` rows are exported.

## Run
```
python tools/content-export/export.py
```
Output (gitignored, reproducible) → `content/release-0.8.0/exports/<dataset_version>/`:
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
failure, never a silent mismatch. No 0.8.0 value triggers this (frequencies/percentages/sizes are all in range).
`python tools/content-export/test_canonical.py` covers parity + the loud-failure boundary.

## Status (Release 0.8.0)
57 packs generate. **Core content validates clean** (rfi_ranges, icm_decisions, lesson_content, coach_grounding,
push_fold_ranges [GTO/Verified-ready], range_viewer, quiz_*, postflop tree, …).

### ⚠️ KNOWN WORKBOOK CONTRADICTION (blocks a fully-valid export; stop condition #5)
~12 sheets fail enum validation because the workbook **data** uses governance-column values **not in their own
`Schema_Registry.AllowedValues`**:
- `ProductionReady` allowed `Yes|No` — data has `Partial`, `Partial (…)`
- `SolverVerified` allowed `Yes|No|N/A` — data has `Partial`, `Yes (cross-ref)`
- `NeedsVerification` allowed `No|Recommended|Yes` — data has `Partial`

Affected: Blind_vs_Blind, Facing_3Bet, Facing_4Bet, IsoRaise, Squeeze, Flop_CBet, Turn_Strategy,
River_Strategy, Coach_Knowledge_Map, Learning_Modules, Premium_Content_Catalog, Source_Map.

This is an **internal workbook inconsistency** (data ⇄ Schema_Registry), surfaced — not bypassed. The exporter
does **not** loosen the contract or rewrite data. **Remediation is content-team / workbook-side** (one of):
1. Extend the `Schema_Registry.AllowedValues` for those columns to include `Partial`/`Partial (…)`/`Yes (cross-ref)`, or
2. Treat those governance columns as free-text (remove the enum), or
3. Normalize the data to the declared enums.
Then re-run the exporter → fully-valid export. Until then, only the clean packs are production-valid.
