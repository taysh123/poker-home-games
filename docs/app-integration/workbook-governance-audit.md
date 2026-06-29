# Workbook Governance Audit — enum contradictions (Release 0.8.0 → RESOLVED in 0.8.1)

> **✅ RESOLVED in workbook 0.8.1.** All 12 contradictions below were reconciled workbook-side. Verified by
> `python tools/content-export/audit_governance.py` (0 contradictions) and a full `export.py` run
> (`total_validation_errors=0`, ALL PACKS VALID) against `content/release-0.8.1/TPoker_Content_Database.xlsx`.
> The analysis below is retained as the historical record of what was fixed and why.

**Status:** READ-ONLY audit (historical). This document **recommended**; it did **not** modify the workbook,
`Schema_Registry`, any cell value, or any `AllowedValues`. Remediation was content-team / workbook-side (0.8.1).

**Audited against:** `content/release-0.8.0/TPoker_Content_Database.xlsx` (the version that had the
contradictions); **resolved in** `content/release-0.8.1/TPoker_Content_Database.xlsx` (now canonical).
**Method:** `python tools/content-export/audit_governance.py` — reuses the exporter's `read_workbook` +
`schema_registry` to scan **every** column that declares `AllowedValues` and report distinct values present
in the data that fall **outside** the declared enum (with row counts). Reproducible and read-only.

## What this is

12 sheets fail the Export_Contract enum validation because the **data** in three governance columns uses
values **not listed in those columns' own `Schema_Registry.AllowedValues`**. This is an internal workbook
inconsistency (data ⇄ registry), surfaced by the exporter (exit 2) and **not bypassed**: the exporter does
not loosen the contract or rewrite data, so the affected packs quarantine instead of shipping invalid.

This does **not** affect already-shipping content: the coach grounding artifact (PR #4) keys off
`VerificationTier` (Calibrated / Nash-Solved — clean) and the quiz packs (PR #5) export clean. Only the
strategy-database and governance sheets below are blocked from a fully-valid export.

## The complete contradiction set

| # | Sheet | Column | Declared `AllowedValues` | Actual offending value(s) — count | Offending / scanned |
|---|-------|--------|--------------------------|-----------------------------------|---------------------|
| 1 | `Blind_vs_Blind_Database` | `ProductionReady` | `Yes \| No` | `Partial` (53), `Partial (raise-or-fold vs mix verify)` (22) | 75 / 77 |
| 2 | `Facing_3Bet_Database` | `ProductionReady` | `Yes \| No` | `Partial (sizing solid; exact freq verify)` (187) | 187 / 187 |
| 3 | `Facing_4Bet_Database` | `ProductionReady` | `Yes \| No` | `Partial (value solid; bluff freq verify)` (84) | 84 / 98 |
| 4 | `Flop_CBet_Database` | `ProductionReady` | `Yes \| No` | `Partial (texture heuristic; verify node freqs)` (160) | 160 / 224 |
| 5 | `IsoRaise_Database` | `ProductionReady` | `Yes \| No` | `Partial` (110) | 110 / 110 |
| 6 | `River_Strategy_Database` | `ProductionReady` | `Yes \| No` | `Partial` (68) | 68 / 106 |
| 7 | `Squeeze_Database` | `ProductionReady` | `Yes \| No` | `Partial` (66) | 66 / 66 |
| 8 | `Turn_Strategy_Database` | `ProductionReady` | `Yes \| No` | `Partial` (90) | 90 / 122 |
| 9 | `Learning_Modules` | `NeedsVerification` | `No \| Recommended \| Yes` | `Partial` (19) | 19 / 28 |
| 10 | `Coach_Knowledge_Map` | `SolverVerified` | `Yes \| No \| N/A` | `Partial` (25) | 25 / 38 |
| 11 | `Source_Map` | `SolverVerified` | `Yes \| No \| N/A` | `Partial` (28), `Yes (cross-ref)` (7) | 35 / 58 |
| 12 | `Premium_Content_Catalog` | `SolverVerified` | `Yes \| No \| N/A` | `Partial` (9), `Pending` (1) | 10 / 17 |

**Two root patterns:**
- **A — a missing tri-state.** Every column has adopted a `Partial` value that its enum never declared.
  On 4 sheets (#2 `Facing_3Bet`, #5 `IsoRaise`, #7 `Squeeze`, and effectively #1) *every or nearly every*
  row is `Partial` — so `Yes|No` was never expressive enough; `Partial` is the de-facto governance state.
- **B — free-text qualifiers smuggled into an enum cell.** Several cells carry a parenthetical rationale
  (`Partial (sizing solid; exact freq verify)`, `Yes (cross-ref)`). This is valuable human governance
  signal, but it lives in the wrong place: an enum cell can't be both machine-checkable and free-text.

## Recommended canonical fix (one per column)

> Single guiding principle: **enumerate the real states; move free-text rationale to a note column.**
> This restores a machine-checkable contract while preserving every governance judgement (least destructive
> — no row's readiness/verification meaning is downgraded or lost).

### #1–#8 · `ProductionReady` (the strategy databases)
**Fix:** Extend `Schema_Registry.AllowedValues` for `ProductionReady` to **`Yes | No | Partial`**, and
**collapse the qualified `Partial (…)` cells to the base token `Partial`**, relocating each parenthetical
rationale into a free-text note column (the strategy sheets already carry `ChangeNote`; otherwise add
`ReadinessNote`).
**Why:** `Partial` is a legitimate third readiness state that several sheets use for 100% of rows — normalizing
it to `No` would falsely mark verified-direction content as not-ready, and to `Yes` would overstate it. The
parenthetical ("exact freq verify", "bluff freq verify") records *what remains to verify* — real signal that
belongs in a note field, not in the enum value space. Net: the enum becomes valid and the notes survive.

### #9 · `Learning_Modules.NeedsVerification`
**Fix:** Extend `AllowedValues` to **`No | Recommended | Yes | Partial`**.
**Why:** `Partial` ("some lessons verified, some not") is a coherent point between `Recommended` and `Yes`
on this column's own scale; adding it is consistent with the tri-state pattern and loses nothing.

### #10 · `Coach_Knowledge_Map.SolverVerified`
**Fix:** Extend `AllowedValues` to **`Yes | No | N/A | Partial`**.
**Why:** Same missing tri-state as the strategy sheets; `Partial` (some mapped concepts solver-verified,
others not) is a real intermediate verification state.

### #11 · `Source_Map.SolverVerified`
**Fix:** Extend `AllowedValues` to **`Yes | No | N/A | Partial`**, and **collapse `Yes (cross-ref)` → `Yes`**,
moving the "cross-ref" qualifier into a `VerificationMethod`/note column.
**Why:** `"cross-ref"` describes *how* the source was verified (method), not a distinct verification *state*;
keeping it inside the enum fractures the value space. `Partial` is the same missing tri-state as elsewhere.

### #12 · `Premium_Content_Catalog.SolverVerified`
**Fix:** Decide whether `Pending` is a real lifecycle state.
- If yes → extend `AllowedValues` to **`Yes | No | N/A | Partial | Pending`**.
- If `Pending` simply means "not yet verified" → **normalize the single `Pending` cell to `N/A`** (or `No`)
  and extend the enum to `Yes | No | N/A | Partial`.
**Why:** `Partial` is the recurring tri-state (enumerate it). `Pending` appears once; either it carries
distinct meaning (then enumerate it for an honest signal) or it's a synonym for an existing value (then
normalize it). Recommended: enumerate both, for an explicit content-lifecycle signal that PR #6 can gate on.

## Cross-cutting recommendation (the durable fix)

Define **one canonical governance vocabulary** in `Schema_Registry` and apply it consistently:

- Readiness / verification tri-state: **`Yes | No | Partial`** (`+ N/A` where the column allows it; `+ Pending`
  only if it is a real, distinct lifecycle state).
- **No free-text inside enum cells.** Parenthetical rationale (`(exact freq verify)`, `(cross-ref)`) moves to
  a dedicated note/method column.

This makes all 12 columns machine-checkable, keeps every human note, and lets the exporter produce a
fully-valid export with no contract change on the app side (`validate.ts` already enforces enum membership,
so the packs validate the moment the registry and data agree).

## Impact / blocked work

The 12 sheets above map to these packs, which currently **quarantine** rather than ship invalid:
`blind_vs_blind_database`, `facing_3_bet_database`, `facing_4_bet_database`, `flop_cbet_database`,
`iso_raise_database`, `river_strategy_database`, `squeeze_database`, `turn_strategy_database`,
`learning_modules`, `coach_knowledge_map`, `source_map`, `premium_content_catalog`.

- **PR #6 (Premium content gating)** depends on `Premium_Content_Catalog` (#12) → **blocked** until that
  sheet's enum is reconciled (genuine stop condition: workbook/export-contract contradiction). Do not start
  PR #6 against the contradicted sheet.
- The clean packs (rfi_ranges, push_fold_ranges, range_viewer, icm_decisions, lesson_content, coach_grounding,
  quiz_*) are unaffected and production-valid today.

## What was NOT done (by design)

No workbook cell, `Schema_Registry` row, `AllowedValues` string, or data value was changed. The exporter was
not loosened. Remediation is a content-team action; once the registry and data agree, re-run
`python tools/content-export/export.py` for a fully-valid export.
