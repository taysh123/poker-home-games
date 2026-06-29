# Sample-Import Execution Checklist (design-only until inputs arrive)

> **Design-only; vendor-neutral; no fabricated data.** The ordered, concrete steps to take ONCE a real export
> sample + format spec + signed right-to-use arrive. Until all three are in hand, **do not build an adapter and
> do not invent a format** (`solver-sample-request-spec.md` §9). Values are spot-checked, never invented; tiers
> are set honestly. This is the build-time companion to `solver-import-pipeline.md`; when it passes, run
> `solver-flip-readiness-checklist.md`.

## 0. Preconditions (all three, or stop)
- [ ] A **real export file** for ≥2 representative scenarios (`solver-sample-request-spec.md` §1).
- [ ] The **format specification** for that export (write the adapter against a documented contract, not a guess).
- [ ] A **dated, signed right-to-use** (redistribute output in-app; audience; attribution; territory; tier
      claim) — per the playbook outcome in `vendor-reply-playbook.md`.

## 1. Build a DRAFT adapter against the REAL format
- [ ] Implement `SolverAdapter { id, canHandle(raw), toPack(raw) }` against the vendor's documented shape — NOT a
      mock. `canHandle` must recognize this source's export only.
- [ ] `toPack` maps the source semantics onto the canonical model (`features/solver/pack/types.ts`):
      per-hand action mix → `strategy[hand] = ActionFrequency[]`; covered hands → `HandKey`; a stable
      `SolverRange.id`; context (`format`/`tableSize`/`stackBb`/`scenario`/`heroPosition`). Map EV→`evBb` and
      equity→`equity` **only where the source provides them**.
- [ ] **Do NOT** populate `evBb`/`equity`/`SolverNode` the source did not give. Combos are DERIVED
      (`logic/combos.ts`), never taken from the source as solver data.

## 2. Register it
- [ ] Add the adapter to `ADAPTERS` in `features/solver/pack/adapters.ts` so `selectAdapter` can pick it. Leave
      `identityAdapter` in place. No other wiring changes — the pipeline is already built.

## 3. Map a small REAL slice → pipeline
- [ ] Run `prepareImport(raw)` (`pack/importPack.ts`): adapter → `validatePack` → contentHash. Expect `ok:true`.
- [ ] `validatePack` (`pack/validate.ts`) must pass every gate:
  - [ ] schema shape + required manifest fields + `schemaVersion` supported.
  - [ ] `verificationTier` ∈ {`solver`,`calibrated`,`illustrative`} (set honestly — §5).
  - [ ] each `action` ∈ {fold,call,raise}; `freq` and `equity` in **0..1**; `evBb` **finite**.
  - [ ] per-hand action mix **sums ≈ 1** (normalize from % in the adapter, do not fudge).
  - [ ] hand keys are **valid 169-grid keys** (`AA`/`AKs`/`AKo`).
  - [ ] **tree integrity**: unique node ids, valid streets, no dangling `parentId`, no cycles, every `nodeRefs`
        resolves (only if the source has postflop nodes).
  - [ ] **contentHash matches** and is **stable across two runs** (deterministic mapping).

## 4. Spot-check values vs the source (NEVER invent)
- [ ] Pick a handful of hands and compare frequencies / sizing / EV / equity to the vendor's export directly.
- [ ] Confirm equity ∈ 0..1 and EV in bb is plausible. If anything is off, fix the **adapter** — never patch the
      data to pass. No gap-filling with invented numbers.

## 5. Set the tier honestly
- [ ] `manifest.verificationTier` = `solver` **only** if it is genuine solver output; otherwise `calibrated`
      (human-tuned, solver-informed) or `illustrative`. Record provenance
      (`solverEngine`/`solverVersion`/`verifiedBy`/`verifiedAt`, `sourceSolver`/`sourceVersion`). The inspector's
      "illustrative" note disappears only for genuinely solver/calibrated data.

## 6. Add a REAL-sample import test
- [ ] Add a test that imports the **real** sample through `prepareImport`/`importAndStore` and asserts validity +
      stable hash + correct tier (alongside the existing fixture tests, which must still pass). The fixture stays
      test-only; the real sample is the new coverage. Confirm `importAndStore` promotes it and a re-import
      replaces (same id) with an identical hash; an intentionally-corrupted copy quarantines (never promoted).

## 7. Verify gates, then flip-readiness
- [ ] `tsc` clean · `jest` green (incl. the new real-sample test) · `expo export -p web` clean.
- [ ] **Flag-OFF byte-identical** preserved (prod with `solver` OFF unchanged).
- [ ] Run **`solver-flip-readiness-checklist.md`** in full (product/backend/UI/security/honesty gates) before the
      `solver` flag goes ON in production.

## What this checklist will NOT do
- Build an adapter, invent a format, or fabricate EV/equity/node values before §0 is satisfied.
- Mark illustrative/derived data as `solver`-tier.
- Patch data to pass validation (fix the adapter instead).

## Cross-links
`solver-import-pipeline.md` · `solver-sample-request-spec.md` (§8) · `solver-flip-readiness-checklist.md` ·
`vendor-reply-playbook.md` · `solver-pack-architecture.md`.
