# Bundled content artifacts — workbook 0.8.1

These JSON files are **generated**, not hand-authored. They are produced by the workbook
exporter (`tools/content-export/`) from the canonical single source of truth
`content/release-0.8.1/TPoker_Content_Database.xlsx`, then copied here so they ship inside
the app bundle (the exporter's `exports/` output dir is gitignored).

| File | Source sheet | Consumer | Regenerate with |
|------|--------------|----------|-----------------|
| `coach_grounding.json` | `Coach_Grounding` | `src/features/coach` — grounded, safe-to-assert claims | `export.py` → copy |
| `quiz_sample.pack.json` | `Quiz_Bank` (sample) | `src/features/study` — quiz runner (ContentStore pack) | `make_quiz_sample.py` |
| `analytics_contract.json` | `Analytics_Events` | `src/analytics` — event → ExportTable contract mapping | `make_analytics_contract.py` |

**Do not edit by hand.** To update: change the workbook, re-run `python tools/content-export/export.py`,
then regenerate the artifacts above (paths follow `tools/content-export/paths.py` → bump `RELEASE` there on a
version change). Verbatim only — no fabrication; verification tiers, citations, and caveats are copied as-is.
The TS side resolves these via `src/content/bundledArtifacts.ts` (single place that `require()`s them) keyed to
`CONTENT_DATASET_VERSION` in `src/content/datasetVersion.ts`.

`quiz_sample.pack.json` is a **deterministic, verbatim cross-section** of `Quiz_Bank` (30 rows). The full quiz
set (~4.5 MB) is too large to bundle unconditionally — that is a deferred size/ops decision. The sample's one
hard FK (`CalibrationProfileID → Calibration_Report.ProfileID`) is softened to a soft `(node)` link so the pack
ingests standalone; this is **sample-only** and never alters the workbook or the real export. `content_hash` is
recomputed by the generator with the same canonicalization as the app reader, so it passes `validate()`.

`coach_grounding.json` shape: `{ dataset_version, claims: GroundedClaim[] }`. The coach serves a
claim as fact **only** when `safe_to_assert === true` (enforced in `logic/grounding.ts`).
