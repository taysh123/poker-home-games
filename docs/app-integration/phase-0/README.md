# Phase 0 — Integration Foundation (Implementation-Ready Blueprint)

Resolves blocker **R1** ("the app cannot consume the workbook directly") by fully specifying the export
artifacts, JSON contracts, SQLite model, ContentStore, ingestion, validation, versioning, bootstrap,
failure/recovery, and offline-first for **Content Release 0.8.0**.

> **Design only — no implementation.** Grounded in a read-only inspection of the actual workbook
> (`TPoker_Content_Database.xlsx`, 62 sheets); every table/field/enum/event/FK cited is real, not invented.

## Approved decisions (recorded)
| # | Decision | Applied as |
|---|----------|-----------|
| D1 | **expo-sqlite** is the content store | Schema-driven content tables; CHECK/FK from `Schema_Registry` (04) |
| D2 | **Content team publishes packs**; app consumes only | App never reads the xlsx or runs the exporter (02, 08) |
| D3 | **Hybrid, bundle-first** | Bundled set ingested at bootstrap; server delivery designed, not required (06) |
| D4 | **Markdown lessons** | `Lesson_Content.BodyText` rendered as Markdown (02, 03) |
| D5 | **Vendor-neutral analytics adapter** | `dispatch()` adapter; 11 events → 9 ExportTables (04, 07) |

## Documents → deliverables
| Doc | Deliverable |
|-----|-------------|
| [01 Phase 0 architecture](01-phase0-architecture.md) | A. Phase 0 architecture |
| [02 Export artifact inventory](02-export-artifact-inventory.md) | B. Export artifact spec (resolves R1) |
| [03 JSON artifact specs](03-json-artifact-specs.md) | B. JSON artifact spec |
| [04 SQLite schema](04-sqlite-schema.md) | C. SQLite schema plan |
| [05 ContentStore design](05-contentstore-design.md) | D. ContentStore design |
| [06 Runtime lifecycle](06-runtime-lifecycle.md) | Versioning · bootstrap · recovery · offline |
| [07 Integration audit](07-integration-audit.md) | E. Dependency graph · order · flags |
| [08 File-by-file plan](08-file-by-file.md) | F. File-by-file implementation plan |
| [09 Risk & readiness](09-risk-and-readiness.md) | G. Risk assessment · H. Order · **READY verdict** |

## 10 Phase 0 foundation items → where covered
1 Export artifact inventory → 02 · 2 JSON specs → 03 · 3 SQLite schema → 04 · 4 ContentStore → 05 ·
5 Pack ingestion → 05 · 6 Validation → 05 · 7 Upgrade/versioning → 06 · 8 Bootstrap → 06 ·
9 Failure/recovery → 06 · 10 Offline-first → 06.

## Source-of-truth facts used (real, from the workbook)
- Enums: `VerificationTier = Nash-Solved|Solver-Verified|Calibrated|Consensus|Educational|Needs-Verification|N/A`,
  `Status = Draft|In-Review|Approved|Published|Deprecated`, `SafeToAssert = Yes|No`.
- 11 events EV-01..EV-11 → 9 ExportTables; 5 mastery rules MM-01..MM-05; 17 packs PACK-01..17.
- `Verification_Readiness`: **Push/Fold = GTO/Verified-ready (98.6% Nash, PASS)**; preflop/ICM/postflop/
  population = Expert Calibrated/Educational, **GTO gate BLOCK**. Overall 26% verified/nash, 0% Solver-Verified.

## Verdict
See [09](09-risk-and-readiness.md): **READY FOR IMPLEMENTATION** for the Phase 0 plumbing (ContentStore +
SQLite + ingest + validation, flag-gated, testable against a fixture pack), with the single operational
dependency that the content team publishes the first conforming pack set (D2).
