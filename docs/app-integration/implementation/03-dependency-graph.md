# 03 — Dependency Graph (D)

Module and phase dependencies, and the hard store boundary.

---

## 1. Module dependency graph
```
deps: expo-sqlite, react-native-markdown-display        config: features.ts (content,mastery), jest.config.js
                         │
   hash.ts ─┐           ▼
 schemaGen.ts ─┼─ backend.ts ──┬─ db.native.ts (sqlite)
  validate.ts ─┘               └─ db.web.ts (in-memory; also jest backend)
                         │
                  contentStore.ts ── migrate.ts
                         │
                     queries.ts ───────────────── ContentContext.tsx  (mounted: GestureHandler > SafeArea >
                         │                                              Currency > Auth > Premium >
        ┌────────────────┼───────────────────────────────┐            Entitlements > **Content > Mastery** >
        ▼                ▼                ▼                ▼            ActiveSession > LocalGames > Bankroll >
  Lessons/Modules   QuizRunner      PostflopTree     grounding.ts       Study > Coach > Engagement)
   (StudyContext)                                   (groundingStore)
        │                                                │
        │                                          CoachContext (contract unchanged)
        ▼
  contentAccess.ts ── EntitlementsContext.has()        marketableLabel.ts ── pack_manifests
        │                                                      │
        └────────────── PackCatalog ◄───────────────────────┘

analytics.ts(track) ─ analyticsContract.ts ─ sink.ts ─► user store (fact/dim, event_id PK)
                                                  │
                                          mastery.ts (MM-01..05 projections) ─ MasteryContext ─ mastery_* tables
```

## 2. Hard store boundary
- **content store** (replaceable; native `content.db` / web in-memory): read-only at runtime; rebuilt on
  ingest via staging swap; prior retained for rollback.
- **user store** (durable; native `user.db` / web persisted): telemetry fact/dim + mastery_* + ingest meta.
  **Never** dropped/altered by content upgrade or rollback. The MasteryEngine is the only component that reads
  content ids and writes user state — it holds both handles but never mixes lifecycles.

## 3. Phase dependency order
```
PR#1 deps/flags/globs ─► PR#2 ContentStore(core) ─► Phase 2 Learning ─► Phase 5 Analytics+Mastery
                                   │                       │                    ▲
                                   ├─► Phase 3 Coach       └────────────────────┘ (events from learning)
                                   ├─► Phase 4 Premium (contentAccess from P1)
                                   └─► Phase 6 Solver display (P1 re-ingest + P4 labels)
```
- Phase 3 (Coach grounding) depends only on the grounding JSON loader — can proceed in parallel with Phase 2
  (no sqlite needed; works on web).
- Phase 5 depends on event sources from Phases 2/4; Mastery depends on the analytics sink.
- Phase 6 is display-only over Phase 1 (versioning) + Phase 4 (labels).

## 4. Critical-path call-outs
- **content_hash recipe** (06 #3) gates *real* ingest → blocks Phase 2+ on real content (not fixtures).
- **content team's first pack set** (D2) gates real content for all consuming phases.
- **expo-sqlite native dep** (PR #1) gates everything native; isolate + verify EAS first.
