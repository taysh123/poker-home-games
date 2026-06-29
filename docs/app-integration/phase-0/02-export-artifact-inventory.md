# 02 — Export Artifact Inventory (B) · resolves R1

The complete set of artifacts the content team publishes (D2) and the app ingests. Each is specified with
**source entities, generated output, schema source, validation, ingestion destination, dependencies, import
priority, update frequency, and access tier** — derived from the real `Export_Contract.export_set:*` rows,
`App_Integration_Map` (45 rows), and `Content_Access_Map` (62 rows). This specification is what unblocks R1:
the app consumes these artifacts, never the `.xlsx`.

---

## 1. Artifact model
- **Per-sheet pack** — the generic schema-driven export of one source sheet: `{ manifest, schema, rows }` (03).
  Destination = one SQLite table named `snake_case(sheet)`. This is the unit of ingest.
- **Export-set bundle** — a named group of per-sheet packs for one app feature (the `export_set:*` rows).
  Bundling/ordering only; no new mechanism.
- **Coach grounding JSON** — `TPoker_coach_grounding.json`, denormalized from `Coach_Grounding` (+
  `Coach_Knowledge_Map`). Served by the coach; `SafeToAssert=Yes` only.
- **Index (future)** — `index.json` listing pack ids/versions/hashes for server delivery (D3; not required 0.8.x).

All packs validate identically (05 §validation): enum membership · required present · FK resolves ·
`VerificationTier=Solver-Verified ⇒ SolveConfigID resolves` · `content_hash` matches.

## 2. Export-set inventory

### curriculum — `AppConsumer: Learning Paths` · ImportPriority 1–2
| Source sheet | Rows | Dest table | Key deps (FK) | UpdateFreq | Access |
|---|---|---|---|---|---|
| Learning_Modules | 28 | `learning_modules` | CalibrationProfileID→Calibration_Report | Quarterly | Premium (rows vary) |
| Lesson_Content | 140 | `lesson_content` | ModuleID→Learning_Modules; LinkedConceptID→Coach_Knowledge_Map; LinkedObjectiveID→Quiz_Learning_Objectives | On update | (renders Markdown, D4) |
| Learning_Tracks | 11 | `learning_tracks` | ModulesIncluded (soft) | Quarterly | Premium |
| Certification_Paths | 6 | `certification_paths` | TracksRequired (soft) | Quarterly | Premium |
| Quiz_Learning_Objectives | 22 | `quiz_learning_objectives` | LinkedModule→Learning_Modules | Quarterly | Premium |

### quizzes — `AppConsumer: Quiz Engine` · ImportPriority 1–3
| Quiz_Catalog 2488 → `quiz_catalog` (primary index) · Quiz_Bank 1460 → `quiz_bank` · Quiz_Advanced 1028 →
`quiz_advanced` · Quiz_Collections 14 → `quiz_collections` (resolve `MemberCriteria` at runtime) ·
Quiz_Difficulty_Map 4 → `quiz_difficulty_map` |. Deps: Catalog `LearningObjectiveID`/`CollectionID`/
`RelatedModuleID`; objectives→modules. UpdateFreq: On update (items) / Quarterly (groupings). Access: Free
(Quiz_Bank) / Premium (Quiz_Advanced) per `Content_Access_Map` + row `FreeOrPremium`.

### postflop_tree — `AppConsumer: Spot/Decision Trainer` · ImportPriority 2 (canonical, solver-compatible)
| Postflop_Sizing_Sets 5 → `postflop_sizing_sets` · Postflop_Nodes 452 → `postflop_nodes` · Postflop_Node_Actions
798 → `postflop_node_actions` |. Deps: Nodes.ParentNodeID/SizingSetID(self,sizing); IPRangeID/OOPRangeID (soft
→ range ids); Actions.NodeID/NextNodeID→Nodes; SolveConfigID→Solver_Runs (on verification). UpdateFreq: On
update. Access: Premium.

### preflop_strategy — `AppConsumer: Spot/Decision Trainer · Range Explorer` · ImportPriority 1
RFI_Ranges 1068 · BB_Defense 536 · Facing_3Bet 187 · Facing_4Bet 98 · Blind_vs_Blind 77 · Squeeze 66 ·
IsoRaise 110 · Range_Viewer_Database 5239 · PushFold_Ranges 2967 · ICM_Decisions 1620 · MTT_20bb_40bb 42 →
tables `snake_case(sheet)`. Common deps: CalibrationProfileID→Calibration_Report, ProvenanceID→Source_Map,
SolveConfigID→Solver_Runs. **Transforms** (per App_Integration_Map): group by position+stack; expand 169-hand
grid; Range_Viewer → 13×13 from `GridRow`/`GridCol`, `ColorCategory`→hex. Access: RFI/BB/PushFold/Range_Viewer
**Free**; ICM/Facing/BvB/Squeeze/Iso/MTT **Premium** (+ row `FreeOrPremium`).

### postflop_flat (authoring view) — `AppConsumer: Spot/Decision Trainer · Study` · ImportPriority 2
Flop_CBet 224 · Turn_Strategy 122 · River_Strategy 106 · Postflop_SRP_IP/OOP 108/99 · Postflop_3BP_IP/OOP 78/75
· Postflop_Fundamentals 503 · Population_Exploits 665. Bridge to the tree via `NodeID`→`postflop_nodes`. Access:
Premium (Population_Exploits Premium; Educational tier). UpdateFreq: On update / Quarterly.

### coach — `AppConsumer: AI Coach` · ImportPriority 1
Primary: **`TPoker_coach_grounding.json`** (from Coach_Grounding 95) — served by the coach. Source
`Coach_Knowledge_Map` 38 (denormalized; concept tiers Beginner/Intermediate/Advanced) → `coach_knowledge_map`
table for "why" lookups. Deps: Coach_Grounding.ConceptID→Coach_Knowledge_Map; EvidenceNodeIDs (soft → strategy
ids). Access: Premium. **Rule: serve `AssertionTemplate` only when `SafeToAssert=Yes`.**

### commerce — `AppConsumer: Premium` · ImportPriority 1
Premium_Content_Catalog 17 → `premium_content_catalog` (storefront) · Content_Packs 28 → `content_packs`
(pack→modules) · Pack_Manifests 17 → `pack_manifests` (verification rollup + `marketable_as` + ≥95% gate) ·
Content_Access_Map 62 → `content_access_map` (gating lookup). Deps: Pack_Manifests.PackID→
Premium_Content_Catalog. Access: catalog/packs/map are **Internal** (drive UI, not sold); packs themselves
gated per `Content_Access_Map` (Free: PACK-01/05/06/12; Premium: 02/03/04/07/08/09/10/11; FuturePack: 13–17).

### diagnostics — `AppConsumer: Leak Finder` · ImportPriority 1–2
Leak_Finder 157 → `leak_finder` (run `DetectionLogic` vs user stats; rank by `SeverityScore`) ·
Leak_Remediation_Paths 10 → `leak_remediation_paths` (LinkedModule→Learning_Modules). Access: Premium.

### study — `AppConsumer: Study · AI Coach` · ImportPriority 2
Study_Plans 614 → `study_plans` (group by plan, order by `StepNumber`) · Mental_Game 100 → `mental_game`
(render as lessons). UpdateFreq: Quarterly. Access: Free.

### analytics (contract only) — `AppConsumer: app emits` · ImportPriority 1
Analytics_Events 11 → `analytics_events` (contract) · Mastery_Model 5 → `mastery_model` (contract). **The app
emits the 11 events and computes mastery; the workbook stores no user data.** See 04 §app-owned tables.

### reference_meta — `AppConsumer: Internal/Trust` · ImportPriority 3
Schema_Registry 1490 (the data contract; drives table generation) · Dataset_Versions 3 (changelog) · Source_Map
58 (provenance/citation) · Calibration_Report 21 (calibration profiles). Access: Internal.

## 3. Coverage check
All 62 sheets are accounted for: 45 consumable (P1/P2) + the meta/trust sheets (P3) + the 3 verification/solver
workflow sheets (`Solver_Runs`/`Solver_Verification_Backlog`/etc.) which are **internal** and not app-ingested
in Phase 0 (they re-export verified content later; 06 §versioning, no app change). `README`/`Audit` = docs only.
