# Bundled content artifacts — workbook 0.8.0

These JSON files are **generated**, not hand-authored. They are produced by the workbook
exporter (`tools/content-export/export.py`) from the signed-off single source of truth
`content/release-0.8.0/TPoker_Content_Database.xlsx`, then copied here so they ship inside
the app bundle (the exporter's `exports/` output dir is gitignored).

| File | Source sheet | Consumer |
|------|--------------|----------|
| `coach_grounding.json` | `Coach_Grounding` | `src/features/coach` — grounded, safe-to-assert claims |

**Do not edit by hand.** To update: change the workbook, re-run `python tools/content-export/export.py`,
then copy `content/release-0.8.0/exports/0.8.0/coach_grounding.json` here. Verbatim only — no
fabrication; verification tiers, citations, and caveats are copied as-is.

`coach_grounding.json` shape: `{ dataset_version, claims: GroundedClaim[] }`. The coach serves a
claim as fact **only** when `safe_to_assert === true` (enforced in `logic/grounding.ts`).
