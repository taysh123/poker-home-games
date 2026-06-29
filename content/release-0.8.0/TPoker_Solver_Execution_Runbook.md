# T Poker — Solver Execution Runbook (Operator)
**Release 0.8.0 · for the operator who will perform solver runs. Zero architectural decisions required.**

> **Golden rule:** never mark anything `Solver-Verified` without a real recorded solver run. The workflow enforces this — `solver_import.py` only promotes rows whose `RunID` exists in `Solver_Runs` and that pass validation.

---

## 0. The loop (at a glance)
`Solver_Run_Templates` (what to solve) → run solver → log `Solver_Runs` (proof) → fill `Verified_Import_Staging` (results) → `python3 solver_import.py` (dry-run) → `--commit` (promote) → re-validate + recalc + version bump + re-export.

## 1. First verification targets (do in this order)
Pulled from `Solver_Run_Templates` (priority order). Start preflop — fastest to verify, immediate pack-label upside.

| # | Target | Sheet(s) | Solver |
|---|---|---|---|
| 1 | **SB raise-or-fold, 100bb 6-max** | `RFI_Ranges` (SB), `Range_Viewer_Database` (RFI SB) | Preflop: **MonkerSolver** or **GTO Wizard AI** |
| 2 | **Facing 3-bet ratios (BTN/CO vs 3-bet)** | `Facing_3Bet_Database`, `Range_Viewer` (3-Bet matrices) | Preflop solver |
| 3 | **BB vs BTN single-raised flop c-bet** | `Flop_CBet_Database`, `Postflop_Nodes` (flop) | Postflop: **TexasSolver** |
| 4 | Push/fold spot-check (10bb UTG/BTN/SB) | `PushFold_Ranges` | **HoldemResources** / **ICMIZER** |

(Each has a ready `SRT-…` row with board/ranges/sizes/accuracy already specified.)

## 2. Required inputs (per target)
- **Preflop (#1–#2):** positions, stack 100bb, open size (2.5–3bb), 3-bet/4-bet sizes from the template; solve to ≤0.5% exploitability; export the per-hand strategy (raise/call/fold or 3-bet/call/fold frequencies).
- **Postflop (#3):** use `TPoker_texassolver_template.json` — fill `set_range_ip` from the BTN RFI matrix and `set_range_oop` from BB defense; board `Qh7d2c`; pot/stack and bet sizes are in the template; `set_accuracy 0.5`.
- **Push/fold (#4):** stack, positions, payout/ICM model (document the model — it affects results); export jam/fold per hand.

## 3. Required outputs (what to capture)
Per hand at the solved node: `Hand`, `Action`, `Frequency` (0–100), and for postflop the `SizePctPot`. Plus the run-level `Exploitability` (%) and the tool + version. Save the raw solver output file and note its location.

## 4. Record the run (proof) — `Solver_Runs`
Add **one row** per solve:
`RunID` (e.g. `SR-001`) · `Tool` · `ToolVersion` · `SpotDescription` · `Board` (or "preflop") · `OOPRange` · `IPRange` · `StackBB` · `BetSizes` · `Exploitability` · `RunDate` · `Operator` · `OutputLocation` · `Status=Complete`.

## 5. Stage the results — `Verified_Import_Staging`
One row per (hand, action):
`StagingID` · `RunID` (must match §4) · `TargetSheet` · `TargetSpotID` (the row/`SpotID`/`NodeID` to update) · `Hand` · `Action` · `Frequency` · `Board` · `StackBB` · `AccuracyPct` (run exploitability) · `ValidationStatus=Pending`.

## 6. Validate & import — `solver_import.py`
```
python3 solver_import.py            # DRY-RUN: validates + annotates staging, no changes
python3 solver_import.py --commit   # PROMOTE: applies Pass rows
```
**Validation rules enforced (all must pass per row):**
1. `RunID` exists in `Solver_Runs` (no orphan verification).
2. `Frequency` numeric in 0–100.
3. `TargetSheet` + target id present and resolvable.
4. Per-hand action frequencies sum to ≈100 (±5).
5. (Run-level) exploitability ≤ target.
Rows failing any rule are marked `Fail` with a note and are **not** promoted.

## 7. Promotion (what `--commit` does)
For each `Pass` row it locates the target by (id, Hand, Action) and:
- copies the current `Frequency` → **`CalibratedValue_Prior`** (audit history preserved),
- writes the solver `Frequency`,
- sets `VerificationTier=Solver-Verified`, `SolveConfigID=RunID`, `VerificationMethod="Solver run (recorded)"`,
- the derived `SolverVerified` flips to `Yes`.
Postflop: the same applies to `Postflop_Node_Actions` (target by `NodeID`).

## 8. Release procedure (after a promotion batch)
```
python3 vg_collect.py && python3 vg_phasea.py          # must print RESULT: PASS
python3 scripts/recalc.py TPoker_Content_Database.xlsx 340   # 0 formula errors
```
Then: add a `Dataset_Versions` row (bump to **0.8.1 / 0.9.0**), recompute `Verification_Coverage` / `Verification_Readiness` and `Pack_Manifests` (re-run their builders), re-export the workbook, and re-export affected packs. A pack auto-upgrades to `GTO / Verified-ready` once ≥95% of its member rows are Nash-Solved or Solver-Verified.

## 9. Postflop specifics
TexasSolver is **postflop only**. Import its output into `Postflop_Node_Actions` (and, for concrete runouts, add child `Postflop_Nodes` with `Board`/`TurnCard`/`RiverCard` and `VerificationTier=Solver-Verified`). The tree schema already accepts this with **no structural change**.

## 10. Stop conditions
If a solver's board/spot doesn't match a target row, do **not** force it — add the spot to `Solver_Verification_Backlog` and create a new `Solver_Run_Templates` row instead. Never edit a `VerificationTier` to `Solver-Verified` by hand; always go through staging + `solver_import.py`.
