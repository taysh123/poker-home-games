# T Poker — App Integration Blueprint (Release 0.8.0)

How the T Poker app integrates the **signed-off content platform, Release 0.8.0**
(`content/release-0.8.0/TPoker_Content_Database.xlsx`, 62 sheets / 23,621 rows + 4 handoff docs).

> **Blueprint only — no implementation.** These documents define the current state, the target architecture,
> a file-by-file plan, a migration plan, and a risk assessment. Nothing here changes app/backend code, imports
> workbook content, runs the exporter, or relabels content as verified.

## Source of truth
- **The workbook is canonical.** The app owns *no* content — only UI/navigation/session-state, content
  **ingest**, and analytics **emission**. (`TPoker_App_Integration_Guide.md`, `…_Handoff.md`.)
- **Honest verification posture preserved:** 0% Solver-Verified today (9,179 Calibrated · 3,643 Nash-Solved ·
  1,168 Educational). The app must never display "GTO/Verified" for a pack below the **≥95%** gate.
- **Supersession:** the earlier `docs/content-architecture/` was a *proposal*. Where it diverges from the
  workbook's `Export_Contract`/`Schema_Registry`, **the workbook wins**; this blueprint aligns to 0.8.0.

## Documents
| # | Document | Deliverable |
|---|----------|-------------|
| 01 | [Current-State Audit](01-current-state-audit.md) | Current-state audit |
| 02 | [Target Architecture](02-target-architecture.md) | Target architecture |
| 03 | [App ⇄ Workbook Mapping](03-app-workbook-mapping.md) | "How the app maps to the workbook" |
| 04 | [File-by-File Implementation Plan](04-file-by-file-plan.md) | File-by-file plan |
| 05 | [Migration Plan](05-migration-plan.md) | Migration plan |
| 06 | [Risk Assessment & Open Decisions](06-risk-assessment.md) | Risk assessment |

## The 9 questions → where answered
| Question | Document |
|---|---|
| 1. How the current app maps to the workbook | 03 (+ 01) |
| 2. What content systems already exist | 01 |
| 3. What content systems must be implemented | 02, 04 |
| 4. How lessons load | 02 §Lessons, 04 |
| 5. How coach grounding loads | 02 §Coach, 04, 06 |
| 6. How content packs load | 02 §ContentStore, 04 |
| 7. How analytics events connect | 03 §Events, 02 §Analytics |
| 8. How mastery tracking connects | 02 §Mastery, 04 |
| 9. How solver-ready content connects | 02 §Solver-ready, 05 (Phase 6) |

## Foundational dependency (flagged early)
`content/release-0.8.0/` currently contains **only the workbook + 4 docs**. The app integrates *exported*
artifacts — **the JSON packs, the pack exporter, and `TPoker_coach_grounding.json` are not in the repo yet.**
Obtaining or producing the export set is a prerequisite for any implementation (see 04 §Build/CI, 06 R1).
