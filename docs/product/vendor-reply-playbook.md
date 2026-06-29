# Solver Vendor Reply Playbook (design-only)

> **Design-only; vendor-neutral; no adapter; no assumed rights; no fabricated data.** What to do the moment a
> solver vendor/source replies to the right-to-use request. Nothing is built and no format is invented until a
> real sample + spec + signed rights arrive. This is not legal advice. Inputs: `solver-sample-request-spec.md`
> §7 (the questions sent), `solver-vendor-evaluation.md` (who/why), the gates in
> `solver-flip-readiness-checklist.md`, and the build steps in `sample-import-execution-checklist.md`.

## Before you read the reply
Have on hand: the exact questions you sent (`solver-sample-request-spec.md` §7 — redistribute solved OUTPUT
in-app? audience free/premium? attribution? territory/field-of-use? provenance clean? tier claim? future public
library?) and the vendor row from `solver-vendor-evaluation.md` §A. Classify the reply into ONE branch below;
when ambiguous, treat it as **(c) Unclear/Partial** — never assume the more permissive reading.

## Decision tree

### (a) Rights GRANTED in writing
A dated, signed confirmation covering redistribution of solved OUTPUT inside the T Poker app (web + mobile),
with audience + attribution + territory stated.
- **Next actions:** file the signed grant; record audience / attribution text+placement / territory / the honest
  tier claim. Request the real export sample + format spec (`solver-sample-request-spec.md` §1) if not already
  provided. Then run **`sample-import-execution-checklist.md`** end-to-end (draft adapter → map → validate →
  spot-check → tier honestly → real-sample test).
- **Still blocked until done:** the `solver` flag stays OFF; no pack ships until the import checklist passes AND
  the **`solver-flip-readiness-checklist.md`** gate is fully green (incl. honesty + flag-off byte-identical).
- **Checklist to run:** `sample-import-execution-checklist.md`, then `solver-flip-readiness-checklist.md`.

### (b) DENIED
Redistribution of output in a paid app is refused (common for SaaS whose data is its moat —
`solver-vendor-evaluation.md` §D #1).
- **Next actions:** record the refusal + date; do NOT purchase-for-redistribution; do NOT scrape or reverse the
  format (explicitly out of scope — `solver-sample-request-spec.md` §9). Move to the next-best vendor in
  `solver-vendor-evaluation.md` §B (e.g. GTO+ for a sample, PioSolver for the automatable core) and re-send §7.
- **Still blocked:** everything — no adapter, no sample import, `solver` OFF. The workspace keeps consuming
  labelled **illustrative** ranges only.
- **Checklist to run:** none yet — return to `solver-vendor-evaluation.md` §C/§E (acquisition plan) for the next
  candidate.

### (c) UNCLEAR / PARTIAL
Personal-use license to *run* the solver is fine but redistribution is silent/ambiguous; or rights are limited
(e.g. free-tier only, attribution-mandatory, territory-restricted, or "internal use" wording).
- **Next actions:** send ONE precise clarifying email pinning the exact `solver-sample-request-spec.md` §7
  boxes that are unanswered (redistribute output? which audience? attribution exact text? territory?). Do not
  proceed on assumptions. If only a *narrow* right is confirmed (e.g. premium-only, with attribution), you MAY
  proceed under exactly those constraints — encode them: set the entitlement (free/premium) via the existing
  seam (`solver-storage.md`), record the required attribution, and set the tier honestly.
- **Still blocked:** any use beyond the explicitly granted scope; `solver` stays OFF until the granted slice
  passes the import + flip checklists.
- **Checklist to run:** once the scope is unambiguous and narrow-but-real → `sample-import-execution-checklist.md`
  then `solver-flip-readiness-checklist.md`, honoring the recorded constraints.

### (d) PARTNERSHIP-REQUIRED
The vendor will license data only via a commercial data/API partnership (the documented GTO Wizard posture —
`solver-vendor-evaluation.md` §A/§D).
- **Next actions:** escalate to a business decision (this is a contract, not an import task) — scope, cost,
  audience, attribution, term, and whether the data may appear in a future public spot library (separate
  consent). Engage counsel for non-trivial redistribution terms. In parallel, keep an independent,
  clearly-licensable source (e.g. PioSolver/GTO+) as the actual import path so the product is not gated on one
  partnership.
- **Still blocked:** no partner data touches the app until a signed agreement exists; the format is API-shaped
  and a concrete adapter is built only after the agreement + a real sample land. `solver` OFF meanwhile.
- **Checklist to run:** after a signed agreement + sample → `sample-import-execution-checklist.md` then
  `solver-flip-readiness-checklist.md`.

## Invariants across all branches
- **No adapter, no invented format, no fabricated EV/equity/node** until a real sample + format spec + signed
  right-to-use are in hand (`solver-sample-request-spec.md` §9).
- Tiers stay honest: only genuine solver output is `solver`; illustrative stays labelled.
- Every branch ends by recording the dated outcome and (when proceeding) running the two checklists in order:
  `sample-import-execution-checklist.md` → `solver-flip-readiness-checklist.md`.

## Cross-links
`solver-sample-request-spec.md` (§7) · `solver-vendor-evaluation.md` · `solver-flip-readiness-checklist.md` ·
`sample-import-execution-checklist.md` · `solver-import-pipeline.md`.
