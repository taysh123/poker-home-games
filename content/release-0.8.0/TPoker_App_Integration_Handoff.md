# T Poker — App Integration Handoff Package
**DatasetVersion 0.8.0 · 2026-06-20 · 61 sheets · 23,603 rows · QC PASS (0 orphans, 0 enum errors, 0 unresolved refs, 0 false Solver-Verified)**

This is the production handoff. After this pass the only remaining major work is **app integration** and **externally executed solver runs**.

---

## 1. Source of truth
The **workbook is the canonical content store**. The app consumes exported packs/JSON; it does **not** own content. Lesson bodies, ranges, the postflop tree, coach grounding, quizzes, packs, governance, and the telemetry/mastery contracts all live in the workbook. The app supplies **UI chrome only** (navigation, rendering, input capture, session state) and **emits** analytics events defined here — it stores no canonical content.

## 2. Sheet inventory by domain
- **Preflop strategy/ranges:** RFI_Ranges, BB_Defense, Facing_3Bet/4Bet_Database, Blind_vs_Blind_Database, Squeeze_Database, IsoRaise_Database, Range_Viewer_Database, PushFold_Ranges, ICM_Decisions, MTT_20bb_40bb.
- **Postflop (flat authoring view):** Flop_CBet_Database, Turn_Strategy_Database, River_Strategy_Database, Postflop_SRP_IP/OOP, Postflop_3BP_IP/OOP, Postflop_Fundamentals, Population_Exploits.
- **Postflop tree (canonical, solver-compatible):** Postflop_Sizing_Sets, Postflop_Nodes (452), Postflop_Node_Actions (798). Flat rows bridge to nodes via `NodeID`.
- **Coach:** Coach_Knowledge_Map (38 concepts), Coach_Grounding (95 claims / 75 numeric, SafeToAssert-gated).
- **Learning:** Learning_Modules (28), **Lesson_Content (140 sections — canonical bodies)**, Learning_Tracks, Certification_Paths, Quiz_Learning_Objectives.
- **Quizzes:** Quiz_Bank, Quiz_Advanced, Quiz_Catalog, Quiz_Collections, Quiz_Difficulty_Map.
- **Diagnostics:** Leak_Finder, Leak_Remediation_Paths.
- **Commerce/packs:** Premium_Content_Catalog (17), Content_Packs, **Pack_Manifests (verification + readiness)**, Content_Access_Map.
- **Governance/verification:** Schema_Registry (the contract), Dataset_Versions, Source_Map, Calibration_Report, Solver_Verification_Backlog, Solver_Runs, Solver_Run_Templates (23), Verified_Import_Staging, Verification_Coverage, Verification_Readiness.
- **Telemetry/mastery:** **Analytics_Events (11), Mastery_Model (5)**.
- **Contracts/meta:** **Export_Contract**, App_Integration_Map, Commercial_Readiness_Report, README, Audit.

## 3. Lesson-body ownership decision (RESOLVED)
**Workbook is canonical for lesson content.** `Lesson_Content` holds real bodies (not pointers): each module has ordered sections (`Overview → KeyNumbers → HowToPlay → Mistakes → Practice`) with prose assembled from Coach_Knowledge_Map and grounded numbers, linked to `ModuleID`, concept, objective, quiz, spot, and leak. **Export rule:** serve a lesson by selecting `Lesson_Content` rows for a `ModuleID` ordered by `SectionOrder`; render `Heading`+`BodyText`. No separate CMS is introduced. App chrome = layout/typography/media only.

## 4. Export / import contract (app ingest)
Defined in-workbook in **`Export_Contract`** and implemented by the pack exporter. Envelope:
```
{ manifest: { dataset_version, pack_id, source_sheet(s), exported, row_count,
              content_hash(SHA-256), verification_rollup{tier:count}, marketable_as },
  schema:  [ {column, datatype, allowed, required, fk} ],   // from Schema_Registry
  rows:    [ {col: val} ] }                                 // Published/Approved only
```
**Validation (every export):** enum membership · required present · FK resolves · *Solver-Verified ⇒ SolveConfigID resolves* · hash matches. Example pack `TPoker_pack_preflop_rfi.json` validates clean (1,068 rows). The coach retrieval layer ships as `TPoker_coach_grounding.json` (serve only `safe_to_assert=true` as fact).

## 5. Analytics / telemetry contract
**`Analytics_Events`** defines 11 client events (lesson_viewed, quiz_started/completed, objective_mastered, leak_found, pack_opened/completed, training_streak, coach_interaction, drill_attempted, session_started) with required fields, content-ID references, and target export tables. **`Mastery_Model`** defines progression rules across objective/concept/pack/track/certification (thresholds + decay + states). **The app emits these events; the workbook stores no user data.** Both are SQLite-portable (each `ExportTable` → a fact/dim table).

## 6. Solver verification workflow (ready; awaits external runs)
Pipeline: `Solver_Run_Templates` → run solver → record `Solver_Runs` → populate `Verified_Import_Staging` → `solver_import.py` validates → promotes to `Solver-Verified` (sets `SolveConfigID`, preserves prior in `CalibratedValue_Prior`) → re-gate + version bump. **Nothing is Solver-Verified today — `Solver_Runs` is empty by design.** Run templates point to the correct tool (preflop → MonkerSolver/GTO Wizard AI; postflop → TexasSolver; push/fold → HRC/ICMIZER). `solver_import.py` (default dry-run) is included and validated against empty staging.

## 7. Pack readiness & verification gate
**`Pack_Manifests`** rolls up `VerificationTier` across each pack's member sheets → `PctVerifiedOrNash`, `ReadinessScore`, `MarketableAs`, and `ContentHash`. **Pack-level rule:** a pack is `GTO / Verified-ready` only when ≥95% of member rows are Nash-Solved or Solver-Verified; otherwise `Expert Calibrated`. Today most packs are `Expert Calibrated` (honest); they upgrade automatically as solver runs land.

## 8. SQLite portability
The `schema` block maps 1:1 to `CREATE TABLE` (datatype→type, `allowed`→CHECK, `fk`→FOREIGN KEY); `rows`→INSERT. Per D-1 the workbook stays the authoring surface now; the export contract *is* the SQLite-ready dump when migration is scheduled.

## 9. Status
**Complete (in-workbook):** verification taxonomy + integrity; governance + versioning (0.8.0); provenance; Schema_Registry; data-derived coach grounding (95 claims); canonical lesson bodies; analytics + mastery contracts; postflop tree (452 nodes / 798 edges, range-anchored, forward-linked); solver workflow + import script; export/import contract; pack manifests.

**Requires external execution:** actual solver runs (preflop first, then postflop) → import via `solver_import.py` to earn `Solver-Verified` and the "GTO" pack label. This is compute that cannot be fabricated here; the structure to receive it is complete.

**Next step:** **app integration** — wire the export contract into the app ingest, render `Lesson_Content`, emit `Analytics_Events`, and consume `Coach_Grounding` (safe-to-assert gating). In parallel, run the first preflop solver verification to begin the Calibrated→Solver-Verified migration.
