# 06 — Risk Assessment & Open Decisions

Severity (S) × Likelihood (L), 1–5. Mitigations are design-level; nothing is implemented here.

---

## Risks

| # | Risk | S | L | Mitigation |
|---|------|---|---|------------|
| **R1** | **Export artifacts/exporter absent from repo** — only the workbook + 4 docs are present; no JSON packs, exporter, or `TPoker_coach_grounding.json`. Implementation is blocked without them. | 5 | 5 | Obtain the exporter or the versioned export set from the content team before Phase 0; until then use a `STARTER_DATASET`-derived bundled pack for plumbing only. Treat as the #1 prerequisite (decision D-2). |
| **R2** | **Dual analytics taxonomies** — app event names ≠ the 11 contract events; naive renaming breaks existing dashboards/tests. | 3 | 4 | Additive `analyticsContract.ts` mapping layer; keep app product events separate from contract events; update `analytics.test.ts`. |
| **R3** | **SQLite dependency + native rebuild** — adopting expo-sqlite adds a native module + EAS rebuild; web has no SQLite. | 3 | 3 | Decision D-1; if chosen, gate behind `content`, provide a web fallback (file+memory) or disable content on web initially. |
| **R4** | **On-device validation cost** — hash + FK + enum checks over 23k rows at ingest could jank first run. | 2 | 3 | Validate once at ingest (not per read); do it off the UI thread / during a loading state; cache validated `dataset_version`. |
| **R5** | **Coach ungrounded-claim leakage** — a non-`SafeToAssert` claim served as fact would break the honesty posture. | 5 | 2 | Enforce `SafeToAssert=Yes` at the single retrieval seam (`grounding.ts`), always render `AssertionTemplate`; unit test that nothing else is assertable; server mirrors the rule. |
| **R6** | **"GTO/Verified" mislabeling** — showing a verified label below the 95% gate is commercially/legally indefensible (0% Solver-Verified today). | 5 | 2 | Display `Pack_Manifests.marketable_as` verbatim; centralize the gate; default to "Expert Calibrated"; test the gate. |
| **R7** | **Pack/export size** — workbook is ~2.9 MB; the full export set bundled inflates app size. | 2 | 3 | Bundle only free/calibrated sets; server-deliver large/premium packs; compress; lazy-load. |
| **R8** | **Versioning drift** — app ingests a `dataset_version` that diverges from server/packs. | 3 | 3 | Record ingested `dataset_version`; re-validate + re-ingest on bump; surface mismatch; immutable versioned packs. |
| **R9** | **No backend content endpoints** — `/api/content/*` doesn't exist; server grounding store doesn't exist. | 3 | 4 | Bundle-first delivery needs no backend; add endpoints only at Phase 5; coach grounding can start client-side. |
| **R10** | **Mastery correctness** — thresholds/decay miscomputed erodes trust. | 3 | 2 | Pure, fully-unit-tested `mastery.ts` against `Mastery_Model` fixtures; compute from canonical events only. |
| **R11** | **Proposal vs workbook divergence** — `docs/content-architecture/` differs from `Export_Contract`. | 2 | 3 | This blueprint supersedes the proposal; align all implementation to 0.8.0; add a note in the old docs. |
| **R12** | **Offline/first-run** — server-only content fails offline. | 2 | 3 | Bundle the starter/calibrated set; cache downloaded packs; `STARTER_DATASET` always present. |

## Open decisions (need an owner before implementation)
- **D-1 Storage tech:** expo-sqlite (SQLite-shaped contract, scales, FK/CHECK; +native dep/rebuild, no web) **vs**
  file-backed JSON + in-memory (no dep, simpler; TS-side validation, weaker at scale). *Recommendation: sqlite for
  native, file+memory fallback for web.*
- **D-2 Who runs the exporter:** app CI consumes the workbook via the exporter **vs** content team publishes a
  versioned pack set the app vendors. *Recommendation: content team publishes; app vendors + re-validates.*
- **D-3 Pack hosting:** bundled-first only **vs** stand up `/api/content/*` (Railway)/CDN now. *Recommendation:
  bundled-first for 0.8.0; add server delivery when premium/solver-verified updates ship.*
- **D-4 Lesson body format:** `BodyText` as Markdown vs plain text (confirm with the content team's authoring).
- **D-5 Analytics vendor** for `dispatch()` (PostHog/Amplitude/none-yet).
- **D-6 SQLite master-store migration** (the workbook's deferred D-1) — when/whether the app's store becomes the
  long-term master shape.

## Honesty guardrails (non-negotiable)
- Never display "GTO/Verified" below the ≥95% gate (R6).
- Never serve a non-`SafeToAssert` claim as fact (R5).
- Never mark or imply content is "Solver-Verified" — it is **0%** today; that status changes only via the
  recorded solver workflow and re-export, never in the app.
