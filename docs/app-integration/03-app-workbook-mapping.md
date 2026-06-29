# 03 — App ⇄ Workbook Mapping

Answers: *how the current app maps to the workbook.* All sheet names, ID prefixes, and event names are quoted
from the 0.8.0 handoff docs (`TPoker_App_Integration_Guide.md`).

---

## 1. Export-set (feature) → app consumer

| Workbook export set | Sheets | App consumer (target) | Today |
|---|---|---|---|
| Curriculum | Learning_Modules, Lesson_Content, Learning_Tracks, Certification_Paths, Quiz_Learning_Objectives | **LessonReader** + study nav | none |
| Quizzes | Quiz_Catalog, Quiz_Advanced, Quiz_Bank, Quiz_Collections, Quiz_Difficulty_Map | **Authored QuizRunner** | RNG sampler only |
| Preflop strategy | RFI_Ranges, BB_Defense, Facing_3Bet/4Bet, Blind_vs_Blind, Squeeze, IsoRaise, Range_Viewer, PushFold, ICM_Decisions, MTT_20bb_40bb | **Trainer / Range viewer** (reuses `buildTrainerHand`/`evaluateSpot`) | `STARTER_DATASET` (5 ranges) |
| Postflop tree | Postflop_Nodes, Postflop_Node_Actions, Postflop_Sizing_Sets | **Postflop tree viewer** | none |
| Postflop flat (authoring view) | Flop_CBet, Turn/River_Strategy, SRP/3BP IP/OOP, Postflop_Fundamentals, Population_Exploits | trainer/lessons (bridge via `NodeID`) | none |
| Coach | Coach_Grounding (+ Coach_Knowledge_Map source) | **Coach grounding loader** (SafeToAssert) | mock templates |
| Commerce | Premium_Content_Catalog, Content_Packs, Pack_Manifests, Content_Access_Map | **Pack catalog + gating** | entitlement primitive only |
| Diagnostics | Leak_Finder, Leak_Remediation_Paths | **Leak finder** | none |
| Study | Study_Plans, Mental_Game | study hub | none |
| Analytics/mastery (contract) | Analytics_Events, Mastery_Model | **AnalyticsEmitter + MasteryEngine** | mismatched `track()` |
| Reference/meta | Schema_Registry, Dataset_Versions, Source_Map, Calibration_Report | ContentStore ingest/validation | none |

## 2. Analytics events — contract → app emission point
The 11 `Analytics_Events` and where the app emits them (existing `track()` calls in `utils/analytics.ts` are
renamed/mapped via `analyticsContract.ts`; "new" = needs an emission point).

| Contract event | App emission point | Source today |
|---|---|---|
| `session_started` | app foreground / study session open | **new** |
| `lesson_viewed` | LessonReader open | **new** |
| `quiz_started` | QuizRunner start | from `study_trainer_started` |
| `quiz_completed` | QuizRunner finish | from `study_trainer_finished` |
| `drill_attempted` | per spot answered | from `study_spot_answered` |
| `objective_mastered` | MasteryEngine threshold crossed | **new** |
| `leak_found` | Leak finder result | **new** |
| `pack_opened` | Pack catalog open | **new** |
| `pack_completed` | Pack progress 100% | **new** |
| `training_streak` | streak engine tick | from `study/logic/progress.ts` (emit) |
| `coach_interaction` | coach analyze req/resp | from `coach_analysis_requested/completed` |

> App-only product events (`onboarding_*`, `paywall_*`, `purchase_*`, `group_*`, `account_created`,
> `local_game_*`, `bankroll_session_logged`, `achievement_unlocked`, `rank_up`) are **not** in the content
> contract and remain app-side analytics. The contract governs **content/learning telemetry**; the app may emit
> additional product events. Each contract event must carry its sheet-defined `RequiredFields` + content-ID refs.

## 3. ID namespaces + FK spine the app must preserve on ingest
Content-ID prefixes (subset; full list in the Guide §3): `RFI` RFI_Ranges, `RNG` Range_Viewer, `PF` PushFold,
`ICM` ICM_Decisions, `PFN`/`PFA` Postflop_Nodes/_Actions, `LC` Lesson_Content, `LM` Learning_Modules,
`CG` Coach_Grounding, `CK` Coach_Knowledge_Map, `PACK`/`PM` packs/manifests, `EV` Analytics_Events,
`MM` Mastery_Model, `DSV` Dataset_Versions, `LEAK` Leak_Finder.

FK spine to enforce (from Guide §4 / `Schema_Registry.ForeignKeyTarget`): every strategy row →
`Source_Map.RowID` (provenance), `Calibration_Report.ProfileID`, `Solver_Runs.RunID` (on verification);
`Coach_Grounding.ConceptID → Coach_Knowledge_Map`; `Lesson_Content.ModuleID → Learning_Modules` (+ `Linked*`);
postflop `ParentNodeID`/`NodeID`/`NextNodeID → Postflop_Nodes`, `SizingSetID → Postflop_Sizing_Sets`;
`Pack_Manifests.PackID → Premium_Content_Catalog`. The ContentStore must reject a pack whose FKs don't resolve.

## 4. Entitlements ↔ commerce
`EntitlementsContext.has(key)` (`PremiumFeatureKey`: `advanced_gto`, `premium_learning`, `ai_coach`, …) composes
with `Content_Access_Map` (which content requires which entitlement) and `Pack_Manifests.marketable_as` (the
label to show). Gate **access**; show `marketable_as` verbatim; enforce the ≥95% "GTO/Verified" gate at display.
