# T Poker — RELEASE 0.8.0 · Master Manifest & Sign-Off
**Release date:** 2026-06-20 · **Status:** RELEASED (content-system closed) · **QC:** PASS · **Content hash:** `e774ae86943f7e97`

Signed off for handoff to the application team. After this release the **only** remaining work is (A) real external solver execution and (B) application integration.

---

## 1. Master Manifest — what is authoritative

| Concern | Authoritative artifact |
|---|---|
| Workbook version | **0.8.0** (DatasetVersion; `Dataset_Versions` DSV-003) |
| Source of truth | **`TPoker_Content_Database.xlsx`** — 62 sheets, 23,621 rows |
| In-workbook manifest | **`Release_Manifest`** sheet (mirror of this doc) |
| Master manifest (doc) | **`TPoker_Release_Manifest.md`** (this file) |
| App handoff | **`TPoker_App_Integration_Guide.md`** |
| Solver runbook | **`TPoker_Solver_Execution_Runbook.md`** |
| Data contract | **`Schema_Registry`** sheet (1,482 field contracts) |
| Export contract | **`Export_Contract`** sheet + pack exporter (example: `TPoker_pack_preflop_rfi.json`) |
| Lesson model | **`Lesson_Content`** sheet (140 sections) — workbook canonical |
| Coach grounding | **`Coach_Grounding`** sheet (95 claims) + `TPoker_coach_grounding.json` |
| Analytics contract | **`Analytics_Events`** + **`Mastery_Model`** sheets |
| Solver workflow | `Solver_Run_Templates` → `Verified_Import_Staging` → `solver_import.py` → `Solver_Runs` |
| Verification status | **0% Solver-Verified (honest)**; 3,643 Nash-Solved + Calibrated; ledger empty |

There is no ambiguity about what is current: **0.8.0**, the files above, nothing else.

---

## 2. Final Release Report

### Release audit (all green)
| Area | Result |
|---|---|
| Workbook integrity | PASS — 0 error/None across 795,655 cells; recalc 0 formula errors |
| Governance coverage | 34 sheets carry `Status`+`DatasetVersion` |
| Verification coverage | Calibrated 9,179 · Nash-Solved 3,643 · Educational 1,168 · **Solver-Verified 0** (26% verified/nash) |
| Provenance coverage | 0 blanks on strategy sheets |
| Tag coverage | 20/20 strategy sheets fully 6-tagged |
| Lesson coverage | 140 sections across **28/28** modules |
| Coach-grounding coverage | 95 claims (75 numeric), **38/38** concepts |
| Postflop-tree integrity | 452 nodes / 798 actions / **0 FK errors**; range-anchored + forward-linked |
| Export-contract integrity | 14 specs; example pack validates clean (1,068 rows, 0 errors) |
| Pack-manifest integrity | 17 packs, rollup + hash + GTO gate |
| Analytics integrity | 11 event contracts |
| Mastery-model integrity | 5 rules |
| Solver-workflow integrity | templates 23 · staging 0 (ready) · ledger 0 (honest) · import script validated |

### Issues found & fixed this pass
- Governance fields added to 2 postflop sub-sheets.
- Two build-time regressions (`-` placeholder tokens; a literal `'None'` in Mastery_Model) — caught by QC, fixed.
- **PK/ID recognition completed** for the newest sheets (`LessonContentID`/`ManifestID`/`MasteryID`/`EventID`/`TemplateID`/`StagingID`) so the ID contract and catalog are complete.
- Re-ran validation / graph / QC / recalc after every fix → all green.

**No further workbook-side work is required to close the release.**

---

## 3. Commercial Readiness Certification

| Area | Verdict | Basis |
|---|---|---|
| Content system | **Ready** | Governed, integrity-checked, versioned (0.8.0), QC green |
| Coach | **Ready with caveats** | 95 grounded claims, SafeToAssert-gated; **caveat:** 20 postflop concepts are qualitative-only and 0% solver-verified |
| Lessons | **Ready** | 140 canonical sections, deterministic export, fully linked |
| Export | **Ready** | Contract + validating exporter + SQLite mapping; example pack clean |
| Governance | **Ready** | Status/version/provenance/author across content; release gates enforced |
| Verification (infrastructure) | **Ready** | Full workflow + import script + audit history |
| Verification (verified content) | **Not ready** | 0% Solver-Verified — requires external solver runs |
| Analytics | **Ready with caveats** | Complete contract; **caveat:** app must implement event emission + mastery computation |
| Premium packs | **Ready with caveats** | Sellable as **"Expert Calibrated"**; **caveat:** "GTO/Verified" label blocked until ≥95% verified |
| Scalability | **Ready with caveats** | Workbook authoring + export scale now; **caveat:** SQLite master-store migration deferred (D-1) for large-scale ops |

**Overall:** the content platform is **production-ready as "Expert Calibrated"** with an honest verification posture. The only "Not ready" item (verified content) is external by design.

---

## 4. Remaining External Work

**A. Real solver execution** — run preflop first (SB raise-or-fold, facing-3bet) then postflop (TexasSolver), record in `Solver_Runs`, import via `solver_import.py` to earn `Solver-Verified` and the GTO pack label. See `TPoker_Solver_Execution_Runbook.md`.

**B. Application integration** — integrate against the export contract, render `Lesson_Content`, emit `Analytics_Events`, consume `Coach_Grounding` with SafeToAssert gating, implement `Mastery_Model`. See `TPoker_App_Integration_Guide.md`.

There is **no remaining workbook-side work**. Both items above are external. Release 0.8.0 is signed off.
