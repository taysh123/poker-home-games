# T Poker content workbook — Release 0.8.1 (canonical)

This folder holds the **canonical** T Poker content workbook, `TPoker_Content_Database.xlsx`,
**version 0.8.1** (`Dataset_Versions` → `0.8.1`, 62 sheets).

0.8.1 is the **governance remediation** of 0.8.0: the enum contradictions in the governance columns
(`ProductionReady` / `SolverVerified` / `NeedsVerification`) are resolved. Verified read-only by
`python tools/content-export/audit_governance.py` → **0 contradictions** across all declared
`Schema_Registry.AllowedValues`. (This is a tooling check, not a content-team sign-off.)

## Rules
- The **workbook is the single source of truth**; the exporter (`tools/content-export`) is the **only**
  bridge into the app. The app **never** reads the workbook at runtime — it consumes exported JSON artifacts.
- Tracked via **Git LFS** (`.gitattributes`: `content/**/*.xlsx`).
- Regenerate exports: `python tools/content-export/export.py` → `exports/0.8.1/` (gitignored, reproducible).

## Release history
- `../release-0.8.0/` is preserved as **archival history** (workbook + 4 signed-off handoff/manifest docs).
- **0.8.1 handoff/manifest docs are pending from the content team.** Until they land, the 0.8.0 docs in
  `../release-0.8.0/` remain the historical integration reference. No 0.8.1 sign-off/QC claims are made here.
