# 07 — Integration Audit, Dependency Graph & Flags (E)

Re-audit of the current codebase for this Phase 0 foundation: what to **reuse / add / refactor / leave
untouched**, the dependency graph, the implementation order, and the feature-flag strategy.

---

## 1. Reuse / Add / Refactor / Untouched
| Area | Verdict | Detail |
|---|---|---|
| Versioned store + quarantine + write-queue (`src/local/localGamesStore.ts`, `studyStore.ts`, `entitlementStore.ts`) | **Reuse (pattern)** | ContentStore copies this exact resilience pattern. |
| `EntitlementsContext.has()` / `PremiumGate` / `PremiumFeatureKey` | **Reuse** | Compose with two-level gating (Content_Access_Map + row FreeOrPremium). |
| `utils/analytics.ts` `track()` + buffer | **Reuse + extend** | Add contract mapping + vendor adapter in `dispatch()` (D5); call sites unchanged. |
| `features/coach` provider seam (`ICoachProvider`, server `ICoachAiProvider`) | **Reuse** | Inject grounding; client contract unchanged. |
| `features/study` trainer logic (`buildTrainerHand`, `evaluateSpot`, `RangeDoc`) | **Reuse** | Trainer reads ranges from ContentStore instead of `STARTER_DATASET`. |
| `expo-file-system` | **Reuse** | Read bundled pack assets; cache server packs. |
| **expo-sqlite** | **Add (dependency)** | New native module (D1); content + user DBs. |
| `src/content/*` (store/db/validate/schemaGen/queries/migrate) | **Add** | The ContentStore (05). |
| `src/features/mastery/*` | **Add** | MM-01..05 engine + state (04). |
| `utils/analyticsContract.ts` | **Add** | Map app events → 11 contract events → 9 ExportTables. |
| `features/study/state/StudyContext.tsx` | **Refactor (additive)** | Source ranges from ContentStore when `content` ON; **fallback to `STARTER_DATASET`**. |
| `App.tsx` providers | **Refactor (additive)** | Mount `ContentProvider` + `MasteryProvider` (flag-gated). |
| Existing screens/session/groups/bankroll/tournament | **Untouched** | No change; production behavior identical when `content` OFF. |
| Backend (.NET) | **Untouched (Phase 0)** | Bundle-first needs no content endpoints; coach grounding can start client-side. |

## 2. Dependency graph (build order implied)
```
expo-sqlite (dep)
   └─ content/db.ts ──┐
content/schemaGen.ts ─┤
content/validate.ts ──┼─ content/contentStore.ts ─ content/queries.ts ─ context/ContentContext.tsx
content/migrate.ts ───┘                                   │
                                                          ├─ StudyContext (ranges)  ─ Trainer/RangeExplorer
                                                          ├─ LessonReader / Modules / Tracks
                                                          ├─ QuizRunner (catalog/collections/objectives)
                                                          ├─ PostflopTree viewer
                                                          ├─ Coach grounding loader ─ coach provider
                                                          └─ PackCatalog ─ contentAccess ∘ EntitlementsContext

analytics.ts ─ analyticsContract.ts ─ dispatch() adapter
   └─ emitted events ─ MasteryEngine (MM-01..05) ─ MasteryContext ─ mastery_* tables
```
Cross-cutting: `config/features.ts` (`content` flag) gates all new nodes. `user.db` (telemetry/mastery) is
independent of `content.db` (content) — they only meet in the MasteryEngine (reads content ids, writes user state).

## 3. Recommended implementation order
1. **Dependency + DB layer** — add `expo-sqlite`; `content/db.ts`, `schemaGen.ts`, `validate.ts` (+ unit tests).
2. **ContentStore + ingest** — `contentStore.ts`, `migrate.ts`, `queries.ts`; ingest a **fixture pack** (derive
   one from `STARTER_DATASET`) end-to-end (ingest→validate→query) behind `content` flag. (Unblocks testing
   before the content team's first published set.)
3. **ContentContext + bootstrap** — mount provider; bundle-set bootstrap (06).
4. **Lessons** (P1, lowest risk, high value) — `LessonReader` + modules/tracks.
5. **Ranges** — `StudyContext` reads from ContentStore (fallback retained); Range Explorer.
6. **Quizzes** + **Postflop tree**.
7. **Analytics contract + Mastery engine** (events → tables → MM rules).
8. **Coach grounding** (SafeToAssert) + **Packs/gating** (two-level + marketable_as).
9. **Diagnostics/Study** content; **(later)** server delivery + index.

## 4. Feature-flag strategy
- **`content`** — master flag (OFF prod, ON dev/beta, like `immersive`/`study`). Gates ContentStore + all
  consumers reading from it. OFF ⇒ `STARTER_DATASET` fallback ⇒ today's app.
- **Per-consumer sub-flags** (reuse existing where present): `study` (trainer/lessons), `coach` (grounding),
  `paywall` (pack gating UI), plus new `mastery` and `analyticsContract`. Each can ship independently.
- **Rollout:** dev → beta soak → (later, out of scope) prod. Any flag OFF reverts that surface with no data loss
  (`user.db` durable).
