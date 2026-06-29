# AI Coach 2.0 (design-only)

> **Design-only; additive, flag-gated, no fabricated data.** Grounded coaching that feeds the EXISTING grounding
> seam (`features/coach/logic/grounding.ts`) with canonical solver/range facts + the reference library, so the
> vendor-neutral provider (`mock`|`server`→Anthropic, key server-side, fail-closed) only ever asserts claims that
> are verifiable. **The coach never fabricates solver numbers.** Nothing surfaces while `coach`/`solver` are OFF
> ⇒ production byte-identical. Canonical model: `solver-pack-architecture.md`.

## The honesty seam (already built)
`logic/grounding.ts` is the single gate: a numeric/qualitative fact is surfaced AS FACT only via `assertion()`,
which returns the verbatim `assertion_template` IFF `safe_to_assert === true` — otherwise `null`. Tiers and
citations are copied verbatim; the module never invents a claim or loosens a tier. AI Coach 2.0 is about *feeding*
this seam from the canonical solver model, not replacing it.

## The current gap (FIRST build step)
Grounding is implemented + tested (`coach/data/__tests__/grounding.test.ts`) but **not yet consumed by the live
prompt** — `serverCoachProvider` posts to `POST /api/coach/analyze` without injecting grounded claims. So the
first, gated, additive build step is: **wire the grounding index into the prompt** so the provider receives
assertable facts and is instructed to assert nothing outside them. No new seam — just connect two built ones.

## Wire diagram
```
SOLVER PACK (canonical: SolverRange + SolverNode, VerificationTier)
   │  buildInspectorView(range, hand)  ── EV/equity ONLY when hasSolverData
   ▼
GROUNDED CLAIMS  (grounding index: assertion() gate, tier + citation verbatim)
   │  + reference library (concept claims)
   ▼
PROMPT  (assertable facts + "assert nothing outside these")
   │
   ▼
PROVIDER  (getCoachProvider: mock | server→Anthropic; key SERVER-SIDE; fail-closed)
   │
   ▼
HONEST RESULT  (claims verifiable; disclaimer; provider id + tier; no fabricated solver numbers)
```

## Feeding the seam with canonical facts
- **Solver/range facts:** for the spot under analysis, derive the honest view via
  `features/solver/logic/inspector.ts` (`buildInspectorView`) — frequencies/sizing/derived combos are always
  real; `evBb`/`equity` are included ONLY when `hasSolverData` is true. These become grounded inputs alongside
  the reference-library `GroundedClaim`s; both pass through the same `assertion()` gate before reaching the
  prompt.
- **Reference library:** concept-level claims already index by `concept_id` (`claimsForConcept` /
  `assertableClaimsForConcept`). The prompt gets only `allAssertions(...)`-style projected facts (assertion +
  tier + citation) for the relevant concepts.
- **Tier flows through:** the pack `VerificationTier` rides with each solver fact; an illustrative pack yields no
  asserted EV/equity numbers — only labelled, qualitative guidance.

## Provider rules (unchanged, vendor-neutral)
- `getCoachProvider` (`coach/providers/index.ts`) selects by id; the app never imports a vendor SDK directly.
  Today: `mock` (honest demo) and `server` (production seam). Anthropic is wired behind `server` — the
  **vendor key, credit reservation, and enforcement live server-side** (`POST /api/coach/analyze`).
- **Fail-closed:** no signed-in token ⇒ `requires_account`; credits/rate-limit checked before the provider runs
  (`logic/coachService.ts` `runAnalysis`); server denials (402/403/429/offline) surface as `CoachError`.
- The result always carries `COACH_DISCLAIMER` + `providerId`; `mock` output is labelled as a demo end-to-end.

## What "2.0" adds (all additive + flag-gated)
1. Inject grounded claims (solver facts + reference library) into the prompt — closes the current gap.
2. Post-generation verification: any solver number in the answer must trace to an asserted claim, else it is
   dropped (not shown) — extends the `assertion()` gate to the model's output, never loosening it.
3. Spot-aware coaching driven by the canonical `SolverNode`/`SolverRange` (and Solver Session Replay steps), so
   "what you should have done" is grounded in the same range the inspector shows.

## Honesty gates (non-negotiable)
- No solver number is asserted unless it came from a `safe_to_assert` claim grounded in real pack data.
- Tiers are never upgraded (illustrative stays illustrative); the educational disclaimer is always present.
- The only synthetic coach output is the labelled `mock` provider; no fabricated EV/equity/node values anywhere.

## Cross-links
`learning-pipeline-architecture.md` · `solver-session-replay.md` · `solver-pack-architecture.md` ·
`hover-inspector-and-compare.md` · `solver-flip-readiness-checklist.md`.
