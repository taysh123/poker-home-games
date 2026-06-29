# 01 — Current-State Audit

What the app has today vs what Release 0.8.0 expects it to consume/emit. Answers: *what content systems already
exist.*

---

## 1. App-side systems that exist

| System | Where | State relative to 0.8.0 |
|--------|-------|--------------------------|
| Study dataset | `features/study/state/StudyContext.tsx`, `data/starterRanges.ts` | Reads a **static bundled** `STARTER_DATASET` (5 ranges, 6-max 100bb). No pack ingest, no `dataset_version`. |
| Trainer / quiz | `features/study/ui/SpotTrainerScreen.tsx`, `logic/trainer.ts` | **RNG-sampled** spots; `QUIZ_LENGTH=10` hardcoded. No authored `Quiz_*` content; no `Quiz_Learning_Objectives`. |
| Coach | `features/coach/*`, server `ICoachAiProvider` | Provider seam + `/api/coach/analyze|credits` exist. **Templated mock; no `Coach_Grounding` consumed**; no `SafeToAssert` gating. |
| Entitlements | `context/EntitlementsContext.tsx`, `features/premium/*` | `has(entitlement)`, `PremiumFeatureKey` (`advanced_gto`, `premium_learning`, …), `PremiumGate`, `/api/entitlements`. No `Content_Access_Map`/`Pack_Manifests` wiring. |
| Analytics | `utils/analytics.ts` | `track(event, props)` → in-memory buffer, dev log, **`dispatch()` is a no-op**. Event names **do not match** the 11-event contract. |
| Mastery | — | **Does not exist.** Streak/daily-goal in `study/logic/progress.ts` only. No objective/concept/pack/track/certification mastery. |
| Storage / transport | `local/localGamesStore.ts`, `utils/storage.ts`, `api/apiClient.ts` | Versioned-load + migrate + quarantine + write-queue pattern; `async-storage` + **`expo-file-system`**; bearer + 401-refresh client. **No expo-sqlite/ORM**, no `contentApi`. |
| Content store / ingest | — | **Does not exist.** No pack parser, no `Schema_Registry`-driven tables, no hash/FK validation. |

## 2. What 0.8.0 expects the app to do
Per `TPoker_App_Integration_Guide.md`: ingest schema-driven JSON packs into an app store; render `Lesson_Content`
(by `ModuleID`/`SectionOrder`); serve `Coach_Grounding` only when `SafeToAssert=Yes` (render `AssertionTemplate`);
emit the 11 `Analytics_Events` with `RequiredFields`; compute `Mastery_Model`; display `Pack_Manifests.marketable_as`
honoring the ≥95% "GTO/Verified" gate; absorb solver-verified content later via re-export with no app change.

## 3. Gap table (exists → required)

| Area | Today | Required by 0.8.0 | Gap |
|------|-------|-------------------|-----|
| Content store | none | schema-driven ingest + validation + query | **Build** |
| Ranges | static `STARTER_DATASET` | ingested range sheets (RFI/BBD/3Bet/PushFold/ICM/…) | **Replace source (keep fallback)** |
| Lessons | none | `Lesson_Content` reader (140 sections / 28 modules) | **Build** |
| Quizzes | RNG-sampled | authored `Quiz_*` + objectives | **Build (keep RNG fallback)** |
| Postflop | none (preflop trainer only) | `Postflop_Nodes`/`_Node_Actions`/`_Sizing_Sets` tree | **Build** |
| Coach grounding | mock templates | `Coach_Grounding` + `SafeToAssert` + `AssertionTemplate` | **Build** |
| Analytics | mismatched event names, no-op dispatch | 11 contract events + provider | **Map + wire** |
| Mastery | none | `Mastery_Model` engine (thresholds + decay + states) | **Build** |
| Packs / gating | entitlement primitive only | `Content_Access_Map` + `Pack_Manifests.marketable_as` + 95% gate | **Wire** |
| Versioning | none | record ingested `dataset_version`; re-ingest on bump | **Build** |

## 4. Exported-artifacts finding (blocking for implementation)
`content/release-0.8.0/` holds only `TPoker_Content_Database.xlsx` + the 4 markdown docs. The app consumes
**exported** artifacts, which are **absent**: the JSON packs (e.g. `TPoker_pack_preflop_rfi.json`), the pack
**exporter**, and `TPoker_coach_grounding.json`. Implementation cannot begin until these are produced from the
workbook (run the exporter) or delivered by the content team. See 04 §Build/CI and 06 R1.

## 5. Reusable seams (do not reinvent)
`localGamesStore` versioned+quarantine+write-queue (→ content cache); `apiClient` (→ `contentApi`);
`EntitlementsContext.has()` + `PremiumGate` (→ content gating); `track()` call sites (→ contract mapping layer);
`ICoachProvider`/`ICoachAiProvider` (→ grounding injection); `expo-file-system` (→ pack storage).
