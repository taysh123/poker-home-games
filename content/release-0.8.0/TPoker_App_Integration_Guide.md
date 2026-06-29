# T Poker — App Integration Guide (Definitive)
**Release 0.8.0 · for an engineering team integrating with zero prior context.**

The workbook `TPoker_Content_Database.xlsx` is the **source of truth**. The app **consumes** it (via exported JSON packs) and **emits** analytics events. The app owns **no canonical content** — only UI, navigation, session state, and event emission.

---

## 1. How integration works (one paragraph)
At build/release time, content is exported from the workbook into JSON packs using the **Export Contract** (§5). The app ingests those packs into its own store (SQLite recommended; the contract is SQLite-shaped). At runtime the app renders **lessons** (`Lesson_Content`), **ranges/strategy** (range + postflop sheets), and the **coach** (`Coach_Grounding`, serving only `SafeToAssert=Yes` as fact), and **emits** the events in `Analytics_Events`, from which it computes mastery per `Mastery_Model`. Solver-verified content arrives later via the solver workflow and re-export — **no app changes needed** when it does.

## 2. Entity catalog (62 sheets by domain)
- **Release/meta:** `Release_Manifest`, `README`, `Audit`, `Dataset_Versions`, `Schema_Registry`, `Source_Map`, `Calibration_Report`, `Solver_Calibration`, `Commercial_Readiness_Report`, `App_Integration_Map`, `Content_Access_Map`, `Export_Contract`.
- **Preflop strategy:** `RFI_Ranges` (1068), `BB_Defense` (536), `Facing_3Bet_Database` (187), `Facing_4Bet_Database` (98), `Blind_vs_Blind_Database` (77), `Squeeze_Database` (66), `IsoRaise_Database` (110), `Range_Viewer_Database` (5239), `PushFold_Ranges` (2967), `ICM_Decisions` (1620), `MTT_20bb_40bb` (42).
- **Postflop (flat authoring view):** `Flop_CBet_Database` (224), `Turn_Strategy_Database` (122), `River_Strategy_Database` (106), `Postflop_SRP_IP` (108), `Postflop_SRP_OOP` (99), `Postflop_3BP_IP` (78), `Postflop_3BP_OOP` (75), `Postflop_Fundamentals` (503), `Population_Exploits` (665).
- **Postflop tree (canonical, solver-compatible):** `Postflop_Sizing_Sets` (5), `Postflop_Nodes` (452), `Postflop_Node_Actions` (798).
- **Coach:** `Coach_Knowledge_Map` (38), `Coach_Grounding` (95).
- **Learning:** `Learning_Modules` (28), `Lesson_Content` (140), `Learning_Tracks` (11), `Certification_Paths` (6), `Quiz_Learning_Objectives` (22).
- **Quizzes:** `Quiz_Bank`, `Quiz_Advanced`, `Quiz_Catalog`, `Quiz_Collections` (14), `Quiz_Difficulty_Map` (4).
- **Diagnostics:** `Leak_Finder` (157), `Leak_Remediation_Paths` (10).
- **Commerce:** `Premium_Content_Catalog` (17), `Content_Packs` (28), `Pack_Manifests` (17).
- **Verification:** `Solver_Verification_Backlog` (28), `Solver_Runs` (0), `Solver_Run_Templates` (23), `Verified_Import_Staging` (0), `Verification_Coverage`, `Verification_Readiness`.
- **Telemetry/mastery:** `Analytics_Events` (11), `Mastery_Model` (5), `Study_Plans` (614), `Mental_Game` (100).

## 3. ID namespace catalog (every entity's id prefix)
| Prefix | Entity | Count |
|---|---|---|
| RNG | Range_Viewer_Database | 5239 |
| PF | PushFold_Ranges | 2967 |
| ICM | ICM_Decisions | 1620 |
| RFI | RFI_Ranges | 1068 |
| PFA | Postflop_Node_Actions | 798 |
| POP | Population_Exploits | 665 |
| SP | Study_Plans | 614 |
| BBD | BB_Defense | 536 |
| PFND | Postflop_Fundamentals | 503 |
| PFN | Postflop_Nodes | 452 |
| FCB | Flop_CBet_Database | 224 |
| F3B | Facing_3Bet_Database | 187 |
| LEAK | Leak_Finder | 157 |
| LC | Lesson_Content | 140 |
| TRN | Turn_Strategy_Database | 122 |
| ISO | IsoRaise_Database | 110 |
| PSRPIP / PSRPOOP | Postflop_SRP_IP / OOP | 108 / 99 |
| RIV | River_Strategy_Database | 106 |
| MG | Mental_Game | 100 |
| F4B | Facing_4Bet_Database | 98 |
| P3BPIP / P3BPOOP | Postflop_3BP_IP / OOP | 78 / 75 |
| BVB | Blind_vs_Blind_Database | 77 |
| SQZ | Squeeze_Database | 66 |
| SRC | Source_Map | 58 |
| CAM | Content_Access_Map | 62 |
| MTT | MTT_20bb_40bb | 42 |
| CK | Coach_Knowledge_Map | 38 |
| SVB | Solver_Verification_Backlog | 28 |
| LM | Learning_Modules | 28 |
| SRT | Solver_Run_Templates | 23 |
| LO | Quiz_Learning_Objectives | 22 |
| CR | Calibration_Report | 21 |
| PACK | Premium_Content_Catalog / Content_Packs | (shared) |
| PM | Pack_Manifests | 17 |
| QCOL | Quiz_Collections | 14 |
| LT | Learning_Tracks | 11 |
| LRP | Leak_Remediation_Paths | 10 |
| CERT | Certification_Paths | 6 |
| MM | Mastery_Model | 5 |
| EV | Analytics_Events | 11 |
| DSV | Dataset_Versions | 3 |
| Q / QA | Quiz_Catalog / Quiz_Advanced | (quizzes) |
| CG | Coach_Grounding | 95 |
| QDM | Quiz_Difficulty_Map | 4 |
| AIM | App_Integration_Map | 45 |
| CRR | Commercial_Readiness_Report | 9 |
| SLV | Solver_Calibration | 46 |

## 4. Relationship map (83 FK edges; the spine)
Every strategy sheet → `Source_Map.RowID` (`ProvenanceID`), `Calibration_Report.ProfileID` (`CalibrationProfileID`), and `Solver_Runs.RunID` (`SolveConfigID`, populated on verification). Plus:
- `Coach_Grounding.ConceptID` → `Coach_Knowledge_Map.RowID`; its `EvidenceNodeIDs` → strategy node ids.
- `Lesson_Content.ModuleID` → `Learning_Modules.ModuleID`; `.LinkedConceptID` → `Coach_Knowledge_Map`; `.LinkedObjectiveID` → `Quiz_Learning_Objectives`; `.LinkedQuizID/SpotID/LeakID` → respective entities.
- `Quiz_Learning_Objectives.LinkedModule` → `Learning_Modules`; `.AssessedByCollection` → `Quiz_Collections`.
- Postflop tree: `Postflop_Nodes.ParentNodeID`/`Postflop_Node_Actions.NodeID`/`.NextNodeID` → `Postflop_Nodes.NodeID`; `.SizingSetID` → `Postflop_Sizing_Sets`; flat `Flop_CBet/Turn/River.NodeID` → `Postflop_Nodes` (the bridge); node `IPRangeID/OOPRangeID` → range entities.
- `Pack_Manifests.PackID` → `Premium_Content_Catalog.PackID`.
- Full edge list is machine-readable in `Schema_Registry` (`ForeignKeyTarget` column).

## 5. Export contract (how to ingest)
Spec lives in the `Export_Contract` sheet. Each pack:
```
{ "manifest": { dataset_version, pack_id, source_sheet(s), exported, row_count,
                content_hash, verification_rollup{tier:count}, marketable_as },
  "schema":  [ {column, datatype, allowed, required, fk} ],   // from Schema_Registry
  "rows":    [ {col: val} ] }                                 // Status in {Published,Approved} only
```
**Validate on ingest:** enum membership · required present · FK resolves · `VerificationTier=Solver-Verified ⇒ SolveConfigID` resolves · `content_hash` matches recomputed SHA-256 of the sorted row body. Reference output: `TPoker_pack_preflop_rfi.json`.

## 6. Required app-side contracts
1. **Ingest**: parse packs per §5; build tables (one per `source_sheet`); enforce `schema` (`allowed`→CHECK, `fk`→FOREIGN KEY).
2. **Lessons**: render a module by selecting `Lesson_Content` where `ModuleID=…` ordered by `SectionOrder`; show `Heading`+`BodyText`. Do not author lesson text app-side.
3. **Coach**: answer from `Coach_Grounding`; serve a claim as fact **only if `SafeToAssert=Yes`**, always rendering `AssertionTemplate` (carries tier + citation + caveat). Treat others as directional.
4. **Analytics**: emit each `Analytics_Events` row's event with its `RequiredFields` and content-ID refs to the named `ExportTable`. The app stores user data; the workbook never does.
5. **Mastery**: compute states from events per `Mastery_Model` (objective/concept/pack/track/certification thresholds + decay).
6. **Verification display**: show `marketable_as` from `Pack_Manifests`; never display "GTO/Verified" for a pack below the 95% gate.

## 7. SQLite mapping
`schema[*]` → `CREATE TABLE source_sheet (... )` with datatype→column type, `allowed`→`CHECK(col IN (...))`, `fk`→`FOREIGN KEY`. `rows` → `INSERT`. `Analytics_Events.ExportTable` defines the fact/dim tables for telemetry. This is the eventual master-store shape (migration deferred per D-1).

## 8. Versioning & change management
`Dataset_Versions` is the changelog; `content_hash` per manifest stamps integrity. On any future content change: re-run validation + QC, bump DatasetVersion, re-export, re-ingest. The app should record the `dataset_version` it ingested.

---

## 9. Required export set by app feature (complete)
Every content entity has an explicit, documented import path below. All use the **same generic schema-driven exporter** (§5) — no new mechanism. This list is mirrored in the `Export_Contract` sheet (`export_set:*` rows).

| Feature | Required sheets to export/import |
|---|---|
| **Curriculum** | Learning_Modules · Lesson_Content · Learning_Tracks · Certification_Paths · Quiz_Learning_Objectives |
| **Quizzes** | Quiz_Catalog · Quiz_Advanced · Quiz_Bank · Quiz_Collections · Quiz_Difficulty_Map |
| **Postflop tree** | Postflop_Nodes · Postflop_Node_Actions · Postflop_Sizing_Sets |
| **Preflop strategy** | RFI_Ranges · BB_Defense · Facing_3Bet_Database · Facing_4Bet_Database · Blind_vs_Blind_Database · Squeeze_Database · IsoRaise_Database · Range_Viewer_Database · PushFold_Ranges · ICM_Decisions · MTT_20bb_40bb |
| **Postflop flat (authoring view)** | Flop_CBet_Database · Turn_Strategy_Database · River_Strategy_Database · Postflop_SRP_IP/OOP · Postflop_3BP_IP/OOP · Postflop_Fundamentals · Population_Exploits |
| **Coach** | Coach_Grounding (primary; serve `SafeToAssert=Yes`) + Coach_Knowledge_Map (source, see §10) |
| **Commerce** | Premium_Content_Catalog · Content_Packs · Pack_Manifests · Content_Access_Map |
| **Diagnostics** | Leak_Finder · Leak_Remediation_Paths |
| **Study** | Study_Plans · Mental_Game |
| **Analytics/mastery (contract)** | Analytics_Events · Mastery_Model (app emits; workbook stores no user data) |
| **Reference/meta** | Schema_Registry · Dataset_Versions · Source_Map · Calibration_Report |

### 9a. Quiz export (explicit)
Quizzes are first-class: export `Quiz_Catalog`/`Quiz_Advanced`/`Quiz_Bank` (items), `Quiz_Collections` (groupings), `Quiz_Difficulty_Map` (difficulty bands). Objectives link via `Quiz_Learning_Objectives.AssessedByCollection` → `Quiz_Collections`, and `Lesson_Content.LinkedQuizID` → quiz items. Mastery events (`quiz_completed`, `objective_mastered`) reference these ids.

## 10. Coach_Knowledge_Map denormalization (explicit)
`Coach_Knowledge_Map` is a **source** sheet, not a separate runtime export. Its concept prose is denormalized into:
1. **`TPoker_coach_grounding.json`** — concept name/category + per-concept claims (what the coach serves), and
2. **`Lesson_Content`** bodies — the explanations assembled into lesson sections.
The app consumes the coach JSON + `Lesson_Content`; it does **not** need a direct `Coach_Knowledge_Map` export. (Its `CG`-prefixed child, `Coach_Grounding`, and the `CK` concept ids are in the §3 ID table.)
