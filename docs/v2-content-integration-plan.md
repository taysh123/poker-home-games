# T Poker V2 — Content Integration Plan (STEP 5)

**Branch:** `feature/v2-poker-platform` · **Date:** 2026-06-20 · No PR/merge. Source: this phase's content audit + `docs/v2-product-polish-plan.md` §E.

## Context
Study/Trainer/Coach are built on a clean, data-driven substrate but content is **hardcoded** (`STARTER_DATASET`, 5 ranges, `isIllustrative:true`) and there is **no content pipeline, no quiz engine, and no coach knowledge layer**. This plan defines how authored content (Google Sheets) becomes JSON datasets and flows into each consumer — **zero-backend first** (bundled JSON) so it ships for beta, with a server catalog as a later upgrade.

## Audit summary (verified)
- **Data model** (`features/study/types.ts`): `RangeDataset { schemaVersion:1; name; isIllustrative; ranges: PreflopRange[] }`; `PreflopRange { id, format, tableSize, stackBb, scenario, heroPosition, villainPosition?, openSizeBb?, label, strategy: HandStrategy }`; `HandStrategy = Record<HandKey, ActionFrequency[]>` (mixed-freq ready).
- **Authoring notation** (`logic/handGrid.ts`): `expandRange("77+, AJs+, KQs, A2o+")` + `buildStrategy({raise, call})` — pure, tested. This is the natural **Google-Sheets cell format**.
- **Injection seam** (`state/StudyContext.tsx`): `dataset: STARTER_DATASET` is the single hardcoded line. The context *accepts* a dataset; all screens read `useStudy().dataset`. Replacing the source needs **no UI changes**.
- **Trainer** (`logic/trainer.ts`): `generateSpot(dataset, rng)` + `evaluateSpot()` — pure; consumes any `RangeDataset`. Decision Trainer (STEP 4.5) is real but currently unfiltered.
- **Quiz**: no distinct engine — Spot Trainer *is* a 10-spot quiz; both trainers share `StudyProgress`.
- **Coach**: server receives only `{kind, heroHand, heroPosition, question, text}` — **no GTO/range reference**. Knowledge injection point = `AnalyzeHandCommandHandler` (server) before `aiProvider.AnalyzeAsync`.
- **Bankroll**: 100% user-entered — no content integration needed.

## Pipeline: Google Sheets → JSON → app

### 1. Authoring (Google Sheets)
One row per range. Columns: `id, format(cash|mtt), tableSize, stackBb, scenario(RFI|vs_RFI), heroPosition, villainPosition, openSizeBb, label, raise, call` — `raise`/`call` use the existing notation (`77+, AJs+, …`). Mixed frequencies (solver data) use an optional `strategyJson` column that overrides notation.

### 2. Build script (offline, repo) — `scripts/build-datasets.mjs` (NEW)
- Reads a CSV/TSV export (or the Sheets API) → for each row, `buildStrategy({raise, call})` (reuse the EXACT pure logic from `handGrid.ts` — share, don't fork) → emit a versioned `RangeDataset` JSON.
- **Validate** each dataset: all 169 hands present, every hand's freqs sum to 1.0 (±ε), valid positions/scenarios, unique range ids. Fail the build on any error.
- Output: `apps/poker-mobile/src/features/study/data/datasets/<id>.json` + a `manifest.json` (id, name, tier, isIllustrative, version). Set `isIllustrative:false` only for verified packs.
- Run in CI as a check so authored content can't ship malformed.

### 3. Delivery — **bundled-first (beta), server-catalog (later)**
- **Beta (zero backend):** ship the JSON files as bundled assets; a `studyContent.ts` loader reads the manifest + selected dataset, **falls back to `STARTER_DATASET`** on any issue. Gated behind a new `studyContent` flag.
- **Post-beta:** `GET /api/study/datasets[/{id}]` + `api/studyApi.ts` + device cache (reuse the versioned-store + quarantine pattern); same loader, remote source. Entitlement-gate premium packs (free starter + premium packs) per polish §E.

### 4. Consumer integration
- **Study module / Spot Trainer / Decision Trainer:** all driven by `useStudy().dataset` — swapping the source is enough. Add Decision-Trainer **filtering** (by `scenario`/`heroPosition`) as packs grow: `generateSpot({ ...dataset, ranges: dataset.ranges.filter(...) })`.
- **Quiz Engine (NEW, build when content exists):** `features/quiz` reusing `RangeDataset` + `generateSpot` with a curated filter + a scored, fixed-length session and a pass mark; persists a small `quizStore` (mirror study). Catalog entry per quiz. *(Spot Trainer covers the MVP quiz need; the richer engine is a content feature, not a beta blocker.)*
- **AI Coach knowledge layer (DESIGN ONLY pre-vendor):** server-side, before the model call, look up the optimal range for `{heroPosition, scenario, stackBb}` from the same dataset (shipped server-side or recomputed) and inject a compact "GTO reference" into the prompt context. Keep the educational disclaimer. Requires the AI vendor (deferred) — design the seam now (`AnalyzeHandCommandHandler` enrich step), build with the vendor.

## What ships for beta vs later
- **Beta:** build script + 1–3 verified bundled packs (or keep the labeled starter) + `studyContent` loader with starter fallback + Decision-Trainer filtering. No backend.
- **Later (V2.1/V3):** server dataset catalog + entitlement gating; Quiz engine; Coach knowledge injection (with vendor); Range Viewer; per-pack progress.

## Verification
Build script unit-tested (notation→strategy parity with `handGrid.test.ts`; validator rejects malformed); loader falls back to starter on corrupt/missing; `SpotTrainerScreen` works unchanged with an imported pack; `tsc` + `jest` green.

## Low-risk win identified (client-only, no backend)
The `studyContent` loader + a validator + bundled-JSON seam is a contained, reversible win (flag-gated, starter fallback). **Recommended as a follow-up increment**, but it is still net-new code across ~3 files — deferred to approval per the "pause before large changes" rule.
