# Bundled content artifacts — workbook 0.8.0

These JSON files are **generated**, not hand-authored. They are produced by the workbook
exporter (`tools/content-export/export.py`) from the signed-off single source of truth
`content/release-0.8.0/TPoker_Content_Database.xlsx`, then copied here so they ship inside
the app bundle (the exporter's `exports/` output dir is gitignored).

| File | Source sheet | Consumer |
|------|--------------|----------|
| `coach_grounding.json` | `Coach_Grounding` | `src/features/coach` — grounded, safe-to-assert claims |
| `quiz_sample.pack.json` | `Quiz_Bank` (sample) | `src/features/study` — quiz runner (ContentStore pack) |
| `analytics_contract.json` | `Analytics_Events` | `src/analytics` — event → ExportTable contract mapping |

**Do not edit by hand.** To update: change the workbook, re-run `python tools/content-export/export.py`,
then copy `content/release-0.8.0/exports/0.8.0/coach_grounding.json` here. Verbatim only — no
fabrication; verification tiers, citations, and caveats are copied as-is.

`quiz_sample.pack.json` is a **deterministic, verbatim cross-section** of `Quiz_Bank` (30 rows) produced by
`python tools/content-export/make_quiz_sample.py`. The full quiz set (~4.5 MB) is too large to bundle
unconditionally — bundling the whole set is a deferred size/ops decision. The sample's one hard FK
(`CalibrationProfileID → Calibration_Report.ProfileID`) is softened to a soft `(node)` link so the pack
ingests standalone; this is **sample-only** and never alters the workbook or the real export. `content_hash`
is recomputed by the generator with the same canonicalization as the app reader, so it passes `validate()`.

`coach_grounding.json` shape: `{ dataset_version, claims: GroundedClaim[] }`. The coach serves a
claim as fact **only** when `safe_to_assert === true` (enforced in `logic/grounding.ts`).
