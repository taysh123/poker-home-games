# 04 — SQLite Schema (C)

The complete on-device model (D1 expo-sqlite). Two halves: **content tables** (read-only replicas of published
packs, schema-driven) and **app-owned tables** (all user data — telemetry, mastery, ingest metadata). Every
workbook entity maps to a table; the workbook stores no user data, so user/telemetry tables are app-designed.

---

## 1. Generation rule (content tables are NOT hardcoded)
For each ingested per-sheet pack, generate the table from its `schema` block (from `Schema_Registry`):
- table name = `snake_case(source_sheet)` (e.g. `RFI_Ranges` → `rfi_ranges`).
- column type: `string→TEXT`, `number→REAL`, `int→INTEGER`, `bool→INTEGER`, `date→TEXT`, `object/array→TEXT(JSON)`.
- `allowed` (enum) → `CHECK(col IN (...))`.
- **hard** `fk` (resolvable target) → `FOREIGN KEY`. **soft** `fk:"(node)"` (polymorphic/optional `Linked*`,
  `EvidenceNodeIDs`, `IPRangeID/OOPRangeID`) → **no FK constraint**; validated as a *warning* at ingest (06) to
  avoid failing on optional cross-entity links.
- PK = the sheet's id column (below).
- `PRAGMA foreign_keys=ON`; `PRAGMA journal_mode=WAL`; content DB attached read-only after ingest.

## 2. Content table map (entity → table, PK, key columns, hard FKs)
| Sheet → table | PK | Notable columns | Hard FKs |
|---|---|---|---|
| RFI_Ranges → `rfi_ranges` | RowID | Position, Hand, Action, Frequency, Sizing, FreeOrPremium, VerificationTier, Status | ProvenanceID→source_map, CalibrationProfileID→calibration_report, SolveConfigID→solver_runs |
| BB_Defense → `bb_defense` | RowID | FacingPosition, Hand, Action, Frequency | (as above) |
| PushFold_Ranges → `pushfold_ranges` | RowID | Position, EffectiveStack, Hand, Action, Frequency | (as above) |
| ICM_Decisions → `icm_decisions` | RowID | Situation, PlayersLeft, StackDistribution, Hand, Action | (as above) |
| Facing_3Bet/4Bet, Blind_vs_Blind, Squeeze, IsoRaise → `*` | SpotID | Scenario, Position, Opponent, Action, Frequency, Sizing | ProvenanceID, CalibrationProfileID, SolveConfigID |
| Range_Viewer_Database → `range_viewer_database` | SpotID | GridRow, GridCol, Hand, Action, Frequency, ColorCategory | (as above) |
| MTT_20bb_40bb → `mtt_20bb_40bb` | RowID | StackDepth, Position, Scenario, Action | ProvenanceID, SolveConfigID |
| Flop_CBet/Turn/River, Postflop_SRP/3BP IP/OOP, Postflop_Fundamentals, Population_Exploits → `*` | RowID/SpotID | board/texture/line + Frequency/Sizing; `NodeID` (flat→tree bridge) | NodeID→postflop_nodes, ProvenanceID, SolveConfigID |
| Postflop_Sizing_Sets → `postflop_sizing_sets` | SizingSetID | Street, SpotType, SizesPctPot | — |
| Postflop_Nodes → `postflop_nodes` | NodeID | ParentNodeID, Street, NodeKind, Board, ToActPosition, SizingSetID | ParentNodeID→self, SizingSetID→postflop_sizing_sets, ProvenanceID, SolveConfigID |
| Postflop_Node_Actions → `postflop_node_actions` | ActionID | NodeID, Action, SizePctPot, Frequency, EV, NextNodeID | NodeID→postflop_nodes, NextNodeID→postflop_nodes, SolveConfigID, ProvenanceID |
| Coach_Knowledge_Map → `coach_knowledge_map` | RowID | Concept, Beginner/Intermediate/Advanced, CoachingScript | (soft Linked*) |
| Coach_Grounding → `coach_grounding` | GroundingID | ConceptID, ClaimText, NumericValue, AssertionTemplate, SafeToAssert | ConceptID→coach_knowledge_map |
| Learning_Modules → `learning_modules` | ModuleID | Track, Difficulty, Prerequisites, LinkedLessons, CompletionCriteria, FreeOrPremium | CalibrationProfileID→calibration_report |
| Learning_Tracks → `learning_tracks` | TrackID | ModulesIncluded, Level, Goal | (soft) |
| Certification_Paths → `certification_paths` | PathID | TracksRequired, PassingCriteria | (soft) |
| Lesson_Content → `lesson_content` | LessonContentID | ModuleID, SectionOrder, SectionType, Heading, BodyText, EvidenceTier | ModuleID→learning_modules, LinkedConceptID→coach_knowledge_map, LinkedObjectiveID→quiz_learning_objectives |
| Quiz_Learning_Objectives → `quiz_learning_objectives` | ObjectiveID | Objective, BloomLevel, LinkedModule, AssessedByCollection | LinkedModule→learning_modules |
| Quiz_Catalog → `quiz_catalog` | QuizID | Category, LearningObjectiveID, CollectionID, RelatedModuleID, FreeOrPremium | (soft Linked*) |
| Quiz_Bank → `quiz_bank` | QuizID | Question, OptionA–D, CorrectAnswer, Explanation, ExamEligible | (soft) |
| Quiz_Advanced → `quiz_advanced` | QuizID | + WhyA/B/C/DIsWrong | (soft) |
| Quiz_Collections → `quiz_collections` | CollectionID | MemberCriteria, LinkedModule | LinkedModule→learning_modules |
| Quiz_Difficulty_Map → `quiz_difficulty_map` | DiffID | DifficultyLevel, TargetTracks | — |
| Leak_Finder → `leak_finder` | RowID | LeakName, DetectionLogic, SeverityScore, EVImpact, Recommended* | (soft) |
| Leak_Remediation_Paths → `leak_remediation_paths` | PathID | TargetLeaks, Step1–4, LinkedModule | LinkedModule→learning_modules |
| Study_Plans → `study_plans` | RowID | PlanName, StepNumber, Module, Exercise | (soft) |
| Mental_Game → `mental_game` | RowID | Category, Concept, Explanation | (soft) |
| Premium_Content_Catalog → `premium_content_catalog` | PackID | PackName, Tier, FreeOrPremium, LinkedContent | — |
| Content_Packs → `content_packs` | PackID(+ModuleID) | ModuleName, ModuleType, EstimatedMinutes | — |
| Pack_Manifests → `pack_manifests` | ManifestID | PackID, SourceSheets, PctVerifiedOrNash, ReadinessScore, MarketableAs, ContentHash | PackID→premium_content_catalog |
| Content_Access_Map → `content_access_map` | AccessID | AssetType, AssetName, AccessTier, AppConsumer | — |
| Schema_Registry → `schema_registry` | (Sheet+Column) | DataType, AllowedValues, Required, ForeignKeyTarget | — |
| Dataset_Versions → `dataset_versions` | VersionID | SemVer, Status, ContentHash, BreakingChanges | — |
| Source_Map → `source_map` | RowID | SourceName, SourceURL, ConfidenceLevel | — |
| Calibration_Report → `calibration_report` | ProfileID (RowID) | trends, ProductionReady | — |

Governance columns present on strategy/content sheets (carried as plain columns; used for display + the gate):
`VerificationTier, VerificationMethod, SolveConfigID, ProvenanceID, Status, DatasetVersion, Author,
ReviewedBy, ApprovedBy, ChangeNote, CalibratedValue_Prior, FreeOrPremium`.

## 3. App-owned tables (user data — workbook never stores these)

### Telemetry (one per `Analytics_Events.ExportTable`)
```sql
CREATE TABLE fact_lesson_views      (user_id TEXT, event_ts TEXT, module_id TEXT, lesson_content_id TEXT, section_type TEXT, dwell_ms INTEGER);          -- EV-01
CREATE TABLE fact_quiz_attempts     (user_id TEXT, event_ts TEXT, quiz_id TEXT, phase TEXT, collection_id TEXT, difficulty TEXT,
                                     score_pct REAL, correct INTEGER, total INTEGER, time_ms INTEGER, objective_id TEXT);                                -- EV-02/03
CREATE TABLE fact_mastery_events    (user_id TEXT, event_ts TEXT, objective_id TEXT, mastery_state TEXT, attempts INTEGER, rolling_accuracy REAL);       -- EV-04
CREATE TABLE fact_leak_events       (user_id TEXT, event_ts TEXT, leak_id TEXT, severity TEXT, remediation_path_id TEXT);                                -- EV-05
CREATE TABLE fact_pack_engagement   (user_id TEXT, event_ts TEXT, pack_id TEXT, phase TEXT, completion_pct REAL, time_total_ms INTEGER, source TEXT);    -- EV-06/07
CREATE TABLE fact_streaks           (user_id TEXT, event_ts TEXT, streak_days INTEGER, timezone TEXT);                                                   -- EV-08
CREATE TABLE fact_coach_interactions(user_id TEXT, event_ts TEXT, concept_id TEXT, grounding_id TEXT, safe_to_assert INTEGER, query_text_hash TEXT, tier TEXT); -- EV-09
CREATE TABLE fact_drill_attempts    (user_id TEXT, event_ts TEXT, spot_id TEXT, correct INTEGER, chosen_action TEXT, gto_action TEXT);                   -- EV-10
CREATE TABLE dim_sessions           (session_id TEXT PRIMARY KEY, user_id TEXT, event_ts TEXT, device TEXT, app_version TEXT);                           -- EV-11
```
Required fields (NOT NULL) follow each event's `RequiredFields`; the rest are optional. `event_ts` indexed.

### Mastery state (per `Mastery_Model` dimension MM-01..05)
```sql
CREATE TABLE mastery_objective    (user_id TEXT, objective_id TEXT, state TEXT, rolling_accuracy REAL, attempts INTEGER, updated_at TEXT, PRIMARY KEY(user_id,objective_id)); -- States: Novice|Learning|Proficient|Mastered
CREATE TABLE mastery_concept      (user_id TEXT, concept_id TEXT, state TEXT, updated_at TEXT, PRIMARY KEY(user_id,concept_id));        -- Aware|Practiced|Confident|Expert
CREATE TABLE mastery_pack         (user_id TEXT, pack_id TEXT, state TEXT, pct REAL, updated_at TEXT, PRIMARY KEY(user_id,pack_id));    -- Started|InProgress|Completed|Mastered
CREATE TABLE mastery_track        (user_id TEXT, track_id TEXT, state TEXT, pct REAL, updated_at TEXT, PRIMARY KEY(user_id,track_id));  -- Enrolled|Progressing|Track-Complete
CREATE TABLE mastery_certification(user_id TEXT, path_id TEXT, state TEXT, exam_score REAL, updated_at TEXT, PRIMARY KEY(user_id,path_id)); -- Eligible|InExam|Certified|Expired
```
Engine implements MM-01..05 verbatim (e.g. MM-01: `accuracy>=85% over >=20 attempts`; demote one state after
30d inactivity). See [07](07-integration-audit.md)/[08](08-file-by-file.md).

### Ingest metadata
```sql
CREATE TABLE content_meta    (key TEXT PRIMARY KEY, value TEXT);                 -- dataset_version, content_hash, ingested_at
CREATE TABLE ingested_packs  (pack_id TEXT PRIMARY KEY, version TEXT, content_hash TEXT, row_count INTEGER, ingested_at TEXT, status TEXT); -- ok|quarantined
CREATE TABLE quarantine_log  (id INTEGER PRIMARY KEY AUTOINCREMENT, pack_id TEXT, reason TEXT, raw_ref TEXT, ts TEXT);
```

## 4. Separation & indexes
- **Two logical DBs** (or attached schemas): `content.db` (replaceable on re-ingest, read-only at runtime) and
  `user.db` (durable user data — never dropped on content upgrade). Keeps mastery/telemetry safe across content
  bumps (06 §versioning).
- Indexes: `lesson_content(ModuleID, SectionOrder)`, `coach_grounding(ConceptID, SafeToAssert)`,
  `postflop_node_actions(NodeID)`, strategy tables `(Position, ...)`/`(SpotID)`, every fact `(user_id, event_ts)`.
