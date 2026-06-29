# Implementation Master Plan — Workbook 0.8.0 → T Poker App

The execution roadmap for bringing the signed-off content platform (Release 0.8.0) into the app. Builds on
`docs/app-integration/` (blueprint) and `docs/app-integration/phase-0/` (architecture), refined by a
5-perspective review (06).

> **Design only.** No implementation, no content import, no flag flips, no relabeling content as verified. The
> workbook and content architecture are finished and not redesigned; this plan refines only the *app-side*
> integration design where the review found implementability issues.

## Decisions (locked)
| # | Decision |
|---|----------|
| D1 | **expo-sqlite** content store (native) |
| D2 | **Content team publishes packs**; app consumes only |
| D3 | **Hybrid bundle-first** delivery |
| D4 | **Markdown** lessons (`react-native-markdown-display`) |
| D5 | **Vendor-neutral analytics adapter** (`dispatch()`) |
| OD-1 | **Web = in-memory JSON query fallback** behind the same ContentStore query interface (native sqlite / web JSON) |

## Documents → deliverables
| Doc | Deliverable |
|-----|-------------|
| [01 Roadmap & phases](01-roadmap.md) | A. Roadmap · B. Phase-by-phase · H. Execution order |
| [02 File-by-file](02-file-by-file.md) | C. File-by-file plan |
| [03 Dependency graph](03-dependency-graph.md) | D. Dependency graph |
| [04 Risk register](04-risk-register.md) | E. Risk register |
| [05 Verification & rollback](05-verification-and-rollback.md) | F. Verification · G. Rollback |
| [06 Review synthesis](06-review-synthesis.md) | 5-perspective review + resolutions |

## Review synthesis (headline resolutions, full detail in 06)
1. **Jest globs gap (verified):** `jest.config.js testMatch` excludes `src/content/` & `src/analytics/` → fix in
   PR #1. 2. **`SolveConfigID` = soft/warning** (no FK to the non-ingested `solver_runs`). 3. **content_hash =
   byte-exact shared helper** pinned by a cross-language fixture (hard dependency on the content team's recipe).
4. **Ingest = whole-content-store staging swap** (atomic; enables rollback; avoids FK-referenced-table drops).
5. **Two physical stores** — content (replaceable) vs user (durable; never touched by upgrade/rollback).
6. **Idempotent analytics** (`event_id` PK + `INSERT OR IGNORE`); **mastery_* = recomputed projections**.
7. **Storage adapter** (`ContentBackend`: sqlite / in-memory) — the in-memory backend doubles as the jest test
   backend. 8. **Provider order** (Content/Mastery inside Entitlements, above Study/Coach). 9. **Lazy
   non-blocking bootstrap**; flag OFF ⇒ byte-identical app. 10. Markdown renderer, two-tree nav mounts, composite
   PKs, early `contentAccess.ts`, honesty single-seams.

## First milestone + first PR
- **PR #1 — Content infra config & deps** (isolated; no logic/UI): add `expo-sqlite` +
  `react-native-markdown-display` + `app.json` plugin; add `content`+`mastery` flags (OFF prod); **fix
  `jest.config.js`** to include `**/src/content/__tests__/**` + `**/src/analytics/__tests__/**` (+ a trivial
  passing test proving the globs run); verify dev-client + EAS boot with `content:false` (byte-identical).
- **PR #2 — ContentStore core** (flag OFF): `ContentBackend` (sqlite + in-memory), `validate.ts`, `schemaGen.ts`,
  `contentStore.ts` (staging swap + quarantine), shared hash helper, fixture packs (STARTER_DATASET + large +
  broken), full tests against the in-memory backend.
- **First user-visible:** Phase 2 Lesson Reader.

## Verdict
**READY FOR IMPLEMENTATION** at PR #1. Real-content ingest is gated only on (a) the content team's first
conforming pack set + `coach_grounding.json` (D2) and (b) locking the content_hash recipe (06 finding #3);
fixture-based Phases 1–2 proceed in parallel. Honesty guardrails hold throughout: **0% Solver-Verified**; show
`MarketableAs` verbatim (only Push/Fold is GTO-ready, 98.6%); coach serves a claim only when `SafeToAssert=Yes`.
