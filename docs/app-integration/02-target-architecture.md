# 02 — Target Architecture

The end-state for consuming Release 0.8.0. Answers: *what must be implemented; how lessons/coach/packs load; how
analytics & mastery connect; how solver-ready content connects.*

---

## 1. Layers

```
 BUILD/RELEASE (content side)            DEVICE (app)                                    SERVER (backend)
 ┌───────────────────────────┐          ┌──────────────────────────────────────────┐   ┌─────────────────────────┐
 │ workbook → exporter        │  packs   │ ContentStore                             │   │ /api/content/* (later)  │
 │  → JSON packs (per sheet)  │ ───────► │  ingest → validate(hash/FK/enum) → store │◄──│ index + signed download  │
 │  + TPoker_coach_grounding  │          │  → query                                 │   │ (premium/updates)        │
 └───────────────────────────┘          │                                          │   │ ICoachAiProvider +       │
                                         │  consumers:                              │   │  KnowledgeStore (ground) │
                                         │   • Lessons reader                       │   └─────────────────────────┘
                                         │   • Ranges/trainer (replaces STARTER)    │
                                         │   • Quiz runner (authored)               │
                                         │   • Postflop tree viewer                 │
                                         │   • Coach grounding (SafeToAssert)       │
                                         │   • Pack catalog + gating                │
                                         │                                          │
                                         │  AnalyticsEmitter → 11 contract events ──┼──► provider (dispatch)
                                         │  MasteryEngine (from events)             │
                                         └──────────────────────────────────────────┘
```

## 2. ContentStore (the core new system) — *how content packs load*
A single module that owns ingest + query; the **only** content source for consumers (replaces the static import).
- **Ingest** (build tables from each pack's `schema` block — schema-driven, no hardcoded columns):
  parse pack → **validate** (enum membership, required present, FK resolves, `Solver-Verified ⇒ SolveConfigID`,
  `content_hash` == SHA-256 of sorted row body) → write to the store → record `dataset_version`.
- **Resilience:** mirror `local/localGamesStore.ts` — versioned load, migration chain, **quarantine** corrupt
  packs (never overwrite a good version), serialized writes.
- **Storage (recommended): expo-sqlite.** The contract is SQLite-shaped (`allowed`→CHECK, `fk`→FOREIGN KEY),
  scales to 23k rows, and serves the FK spine + mastery queries. *Alternative:* file-backed JSON
  (`expo-file-system`) + in-memory indexes with TS-side validation (no native dep). **Decision D-1 (06).**
- **Delivery: hybrid, bundle-first.** Bundle the "Expert Calibrated" export set at build time (offline, matches
  "export at build/release time"); server-deliver large/premium/solver-verified **updates** later via
  `/api/content/*` reusing the cache/quarantine pattern.

## 3. Lessons — *how lessons load*
`LessonReader` selects `Lesson_Content` rows for a `ModuleID`, ordered by `SectionOrder`, renders
`Heading`+`BodyText` (canonical sections: Overview → KeyNumbers → HowToPlay → Mistakes → Practice). The app
authors **no** lesson text; it owns layout/typography/media only. `Learning_Modules`/`Learning_Tracks`/
`Certification_Paths` drive navigation; `Lesson_Content.Linked*` ids deep-link to concept/objective/quiz/spot/leak.

## 4. Ranges / trainer / postflop
Trainer reads ranges from the ContentStore (RFI/BB_Defense/Facing_3Bet/4Bet/BvB/Squeeze/Iso/Range_Viewer/
PushFold/ICM/MTT) instead of `STARTER_DATASET` (kept as offline fallback). Postflop tree viewer reads
`Postflop_Nodes`/`_Node_Actions`/`_Sizing_Sets` (flat sheets bridge via `NodeID`). Existing `buildTrainerHand`/
`evaluateSpot` are reused — `RangeDoc` shape is compatible.

## 5. Coach grounding — *how coach grounding loads*
Load `TPoker_coach_grounding.json` (denormalized from `Coach_Grounding` + `Coach_Knowledge_Map`).
**Enforcement:** a claim is served **as fact only if `SafeToAssert=Yes`**, always rendering its
`AssertionTemplate` (carries tier + citation + caveat); all others are directional. Two seams:
- **Client lookup** for instant "why" hints next to spots (uses on-device grounding for already-ingested packs).
- **Server `ICoachAiProvider`** grounds full analyses from a server `KnowledgeStore` (commercial IP + vendor key
  stay server-side). Client contract unchanged. No ungrounded claim can leak (06 R5).

## 6. Analytics — *how analytics events connect*
Keep existing `track()` call sites. Add `utils/analyticsContract.ts` that maps app events → the 11
`Analytics_Events` with their `RequiredFields` + content-ID refs, and wire a real provider in `analytics.dispatch()`.
The app emits; the workbook stores no user data. (Mapping table in 03 §Events.)

## 7. Mastery — *how mastery tracking connects*
`features/mastery/` computes objective/concept/pack/track/certification states from emitted events per the
5 `Mastery_Model` rules (thresholds + decay + states). Pure, testable engine + a small persisted store
(versioned, mirroring `studyStore`). Reuses the streak/daily-goal engine where overlapping.

## 8. Packs & gating
Pack catalog reads `Premium_Content_Catalog`/`Content_Packs`/`Pack_Manifests`. Access gated by
`EntitlementsContext.has()` composed with `Content_Access_Map`. **Display `Pack_Manifests.marketable_as`
verbatim**; never render "GTO/Verified" below the ≥95% gate (06 R6).

## 9. Solver-ready — *how solver-ready content connects*
**No app change.** When external solver runs land (`Solver_Runs` → `solver_import.py` → re-export), packs
re-export with upgraded `VerificationTier`/`marketable_as` and a bumped `dataset_version`; the app re-ingests and
labels update automatically. The 95% gate flips packs to "GTO/Verified-ready" without code changes.
