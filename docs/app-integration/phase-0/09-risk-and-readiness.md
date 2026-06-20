# 09 — Risk Assessment & Readiness (G, H)

Severity (S) × Likelihood (L), 1–5. R1 is now resolved **at the contract level** by 02/03/04; remaining risks
are implementation-side and mitigated by the design.

---

## 1. Risks
| # | Risk | S | L | Mitigation |
|---|------|---|---|------------|
| **R1** | App can't consume the workbook directly | 5 | — | **RESOLVED (design):** app consumes published per-sheet packs + coach JSON (02/03); never reads the xlsx. Operational unblock = content team publishes the first conforming set (D2). |
| R2 | expo-sqlite on **web** (Expo web has limited/wasm SQLite) | 3 | 3 | `content` flag can disable content on web initially; or use the wa-sqlite/OPFS path; web is secondary to native. Decide at impl start. |
| R3 | Native rebuild / EAS friction from new dep | 2 | 3 | Add `expo-sqlite` in one isolated PR; verify dev-client + EAS build before consumers. |
| R4 | **Two-level gating** correctness (AccessTier + row FreeOrPremium) | 4 | 3 | Single `contentAccess.ts` primitive composing both with `has()` (fail-closed); unit-tested truth table. |
| R5 | **Coach ungrounded leakage** | 5 | 2 | Single seam serves `safe_to_assert=true` only, always renders `assertion_template`; unit test forbids others; server mirrors. |
| R6 | **Honest labeling** — showing "GTO/Verified" below the gate | 5 | 2 | Show `pack_manifests.MarketableAs` verbatim; only **Push/Fold** is GTO-ready (98.6%, PASS); centralize gate; test. |
| R7 | Ingest cost / first-run jank (23k rows) | 2 | 3 | Validate+insert once at bootstrap in a transaction, off the UI thread; cheap integrity check thereafter. |
| R8 | Pack/bundle size in the binary | 2 | 3 | Bundle "Expert Calibrated" set only; compress; large/premium via server later (D3). |
| R9 | Dual analytics taxonomy (app events vs 11 contract) | 3 | 4 | Additive `analyticsContract.ts` mapping; keep app product events separate; update `analytics.test.ts`. |
| R10 | Mastery correctness (thresholds/decay) | 3 | 2 | Pure `mastery.ts` tested against MM-01..05 fixtures; compute from canonical events only. |
| R11 | Content/version drift app↔packs | 3 | 3 | Record `dataset_version`+hash; re-validate+re-ingest on bump; atomic swap; rollback; `user.db` untouched. |
| R12 | Soft `(node)` links over-constraining ingest | 2 | 3 | Soft links are warnings, **not** FK constraints (04/06) → optional/polymorphic refs never block ingest. |
| R13 | First published pack set not yet in repo | 4 | 4 | Build/test against a `STARTER_DATASET`-derived **fixture pack** (07 order step 2) until D2 delivers. |

## 2. Open decisions (small; non-blocking)
- **OD-1** expo-sqlite web strategy (disable-on-web vs wasm). **OD-2** analytics vendor for the adapter (still
  deferred; adapter is vendor-neutral). **OD-3** bundle layout/versioned asset path. None blocks starting.

## 3. Honesty guardrails (must hold in implementation)
- Show `MarketableAs` verbatim; **never** "GTO/Verified" below ≥95% (only Push/Fold qualifies today).
- Serve a coach claim as fact **only** when `safe_to_assert=true`.
- **0% Solver-Verified** — nothing in the app implies otherwise; verified content only ever arrives via the
  content team's solver workflow + re-export (no app-side relabeling).

## 4. Recommended implementation order (H)
Per [07 §3]: (1) dep+DB layer → (2) ContentStore+ingest against a fixture pack → (3) ContentContext+bootstrap →
(4) Lessons → (5) Ranges → (6) Quizzes+Postflop → (7) Analytics contract+Mastery → (8) Coach grounding +
Packs/gating → (9) Diagnostics/Study; server delivery later. Each step flag-gated, additive, independently
shippable; `user.db` durable across content changes.

## 5. Verdict

**READY FOR IMPLEMENTATION.**

The Phase 0 foundation is fully specified and grounded in the real workbook: the export artifact set + JSON
contracts (02/03), the complete SQLite model incl. app-owned user/telemetry/mastery/meta tables (04), the
ContentStore design with ingest/validate/version/rollback (05/06), and the integration order + flags (07/08).
Implementation can begin **safely now**, behind the `content` flag, starting with the dependency+DB layer and
the ContentStore validated end-to-end against a `STARTER_DATASET`-derived **fixture pack** — with **no
production impact** until flags flip.

**Single operational dependency:** the content team publishes the first conforming pack set + `coach_grounding.json`
(D2) per 02/03 to ingest *real* 0.8.0 content (fixture-pack development can proceed in parallel before then).
