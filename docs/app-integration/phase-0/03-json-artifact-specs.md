# 03 — JSON Artifact Specifications (B)

The exact JSON shapes the content team publishes and the app ingests. Envelope fields are quoted from the
real `Export_Contract` (27 rows); examples use real workbook rows.

---

## 1. Per-sheet pack envelope
```jsonc
{
  "manifest": {
    "dataset_version": "0.8.0",                 // workbook DatasetVersion at export
    "pack_id": "preflop_strategy.rfi_ranges",   // export-set.sheet (engineering) — see note
    "source_sheet(s)": "RFI_Ranges",
    "exported": "2026-06-20T00:00:00Z",
    "row_count": 1068,
    "content_hash": "sha256:…",                 // SHA-256 over the SORTED row body (integrity)
    "verification_rollup": { "Calibrated": 1068 }, // {VerificationTier: count}
    "marketable_as": "Expert Calibrated"        // GTO/Verified-ready | Expert Calibrated | Curriculum | Educational
  },
  "schema": [                                    // from Schema_Registry (Sheet=RFI_Ranges)
    { "column": "Position",        "datatype": "string", "allowed": ["UTG","HJ","CO","BTN","SB","BB"], "required": "Y", "fk": null },
    { "column": "Hand",            "datatype": "string", "allowed": null, "required": "Y", "fk": null },
    { "column": "Action",          "datatype": "string", "allowed": ["Raise","Call","Fold","Limp","3Bet","..."], "required": "Y", "fk": null },
    { "column": "Frequency",       "datatype": "number", "allowed": null, "required": "Y", "fk": null },
    { "column": "VerificationTier","datatype": "string", "allowed": ["Nash-Solved","Solver-Verified","Calibrated","Consensus","Educational","Needs-Verification","N/A"], "required": "Y", "fk": null },
    { "column": "Status",          "datatype": "string", "allowed": ["Draft","In-Review","Approved","Published","Deprecated"], "required": "Y", "fk": null },
    { "column": "SolveConfigID",   "datatype": "string", "allowed": null, "required": "N", "fk": "Solver_Runs.RunID" },
    { "column": "ProvenanceID",    "datatype": "string", "allowed": null, "required": "N", "fk": "Source_Map.RowID" },
    { "column": "CalibrationProfileID","datatype":"string","allowed":null,"required":"N","fk":"Calibration_Report.ProfileID" }
    /* …full column set per Schema_Registry; soft Linked* refs carry fk:"(node)" → validated as warnings, not FK */
  ],
  "rows": [                                      // Published/Approved Status only; nulls preserved
    { "Position": "UTG", "Hand": "AKs", "Action": "Raise", "Frequency": 100, "VerificationTier": "Calibrated",
      "Status": "Approved", "RowID": "RFI-0001", "FreeOrPremium": "Free", "DatasetVersion": "0.8.0" /* … */ }
  ]
}
```
> **pack_id note:** `Export_Contract` defines `pack_id` as the `PACK-` id (commercial roll-ups in
> `Premium_Content_Catalog`). For the **engineering ingest unit** we use a stable `export_set.sheet` id (one
> table per sheet); commercial `PACK-*` manifests (`pack_manifests` table) reference these tables for the
> storefront. Both are published by the content team; the app treats `pack_id` as an opaque stable key.

## 2. SQLite mapping rule (from `Export_Contract._sqlite_map`)
`schema[*]` → `CREATE TABLE snake_case(source_sheet) (...)`: `datatype`→column type, `allowed`→`CHECK(col IN
(...))`, hard `fk`→`FOREIGN KEY`; `rows`→`INSERT`. Detailed in [04](04-sqlite-schema.md).

## 3. Coach grounding JSON (`TPoker_coach_grounding.json`)
Denormalized from `Coach_Grounding` (95) + `Coach_Knowledge_Map` (38). Real example (CG-001):
```jsonc
{
  "dataset_version": "0.8.0",
  "concepts": [
    { "concept_id": "CK-001", "category": "Preflop", "name": "Opening ranges",
      "explanations": { "beginner": "…", "intermediate": "…", "advanced": "…" } }
  ],
  "claims": [
    {
      "grounding_id": "CG-001", "concept_id": "CK-001",
      "claim_text": "UTG opens ~13.4% (RFI) at 100bb 6-max",
      "numeric_value": 13.4, "unit": "%",
      "evidence_node_ids": ["RNG-0001"], "evidence_sheet": "Range_Viewer_Database",
      "verification_tier": "Calibrated", "confidence_level": "High", "confidence_score": 75, "evidence_count": 1,
      "citation": "Derived from calibrated ranges (https://blog.gtowizard.com/)",
      "assertion_template": "UTG opens ~13.4% (RFI) at 100bb 6-max (Calibrated; source: Derived from calibrated ranges). Not solver-exact.",
      "grounding_type": "Quantitative",
      "safe_to_assert": true
    }
  ]
}
```
**Serving rule:** the coach renders `assertion_template` as fact **only when `safe_to_assert === true`**; all
other claims are directional context. Today all 95 claims are `Calibrated` tier (none solver-verified).

## 4. Lesson body (Markdown, D4)
`lesson_content` rows are served by `ModuleID` ordered by `SectionOrder`; render `Heading` + `BodyText` as
**Markdown**. `SectionType ∈ {Overview, KeyNumbers, HowToPlay, Mistakes, Practice}`. Real example: LC-0001
(`LM-01`, SectionOrder 1, Overview, "Preflop Opening Ranges: Overview"). The app authors no lesson text.

## 5. Datatypes & nulls
Datatypes from `Schema_Registry.DataType` (`string|number|int|date|object|array|bool`). Nulls are preserved in
`rows` (not dropped) so optional columns stay addressable. Numeric frequencies are 0–100 (percent) per the
strategy sheets and the solver import rules.
