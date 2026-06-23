# Solver Flip Readiness Checklist (design-only, vendor-neutral)

> **Purpose:** the gate that must be GREEN before real EV/equity/node data is imported and the `solver` flag is
> turned ON in production. Everything below is additive + reversible; until it's met, the workspace stays
> flag-OFF and consumes only illustrative ranges (labelled). **No fabricated values; no adapter until a real
> sample exists** (see `solver-sample-request-spec.md`).

## 0. Preconditions (data + rights)
- [ ] A **real solver export sample** + its **format spec** received (per the request spec).
- [ ] **Right-to-use** confirmed in writing (redistribute in-app; audience; attribution; territory; tier claim).
- [ ] A **concrete adapter** implemented against the real format + registered in `pack/adapters.ts` (`ADAPTERS`).
- [ ] A **real pack** maps cleanly: `prepareImport` → `validatePack` passes (schema/enums/freq+equity 0..1/evBb
      finite/tree integrity/hash); tier set honestly; values spot-checked against the source.
- [ ] The fixture-driven pipeline tests still pass **plus** a new test that imports the **real** sample (not a
      fabricated one).

## 1. Product
- [ ] Decide **distribution**: bundled-in-app vs server-delivered packs.
- [ ] Decide **entitlement**: free vs premium packs (reuse the existing entitlement seam; do not bypass).
- [ ] Decide the **first scenarios** to ship (e.g. core cash RFI + key facing spots).
- [ ] Confirm the **verification-tier policy**: only genuine solver output is `solver`; everything else
      `calibrated`/`illustrative`. The inspector tier label + "illustrative" note are driven by this.

## 2. Backend
- [ ] If **server-delivered**: a pack-delivery endpoint + entitlement check (reuse content/entitlement seams);
      add `connect-src` for that origin to the CSP when it goes enforcing. If **bundled**: pack ships as an app
      asset — no endpoint.
- [ ] **No EF migration** for client-side packs (they live in `solverPackStore`, AsyncStorage). **Decision
      point:** if packs become server entities (catalog/versioning/entitlement rows), a schema + migration is
      required — design that separately before building it.
- [ ] Provenance/audit if packs are distributed (who/when/version) — optional, recommended at scale.

## 3. App UI
- [ ] Flip `solver` (beta/dev → prod) **only when** §0–§2 are green.
- [ ] Add a prominent **web nav entry/tab** for the solver workspace (currently reachable via the `/solver` deep
      link + the flag-gated Study card).
- [ ] Point the workspace at the **verified pack** (the illustrative ranges remain a labelled fallback).
- [ ] No inspector change needed — it already renders EV/equity **when present** + the tier label; verify the
      "EV/equity only in imported solver packs" note disappears for solver/calibrated packs.
- [ ] **Performance** (per `solver-performance-budget.md`): virtualize range/node lists > ~50 for large packs;
      lazy-load pack bodies; confirm the grid stays < 16ms (RangeCell memo + lazy hover content already in place).
- [ ] Accessibility unchanged (focus states, a11y labels, reduced-motion already handled).

## 4. Security / release docs
- [ ] Update `docs/release/commercial-readiness.md` + `docs/product/web-first-final-report.md`: solver data is
      no longer illustrative-only; record the data rights + tier.
- [ ] **Legal:** if showing solver data, confirm Terms/usage reflect the data rights + any required attribution
      (counsel if redistribution terms are non-trivial). Privacy: no new PII expected — confirm.
- [ ] **CSP:** if packs load from a new origin (server/CDN), add it to `connect-src` and move CSP from
      report-only → enforcing once the report stream is clean (`web-security-headers.md`).
- [ ] **Rollback:** packs are additive + flag-gated — rollback = flip `solver` OFF / remove the pack; the store
      quarantines bad data and never loses the live set. Confirm the rollback note in `rollback-recovery.md`.

## 5. Verification gates (all green before flip)
- [ ] `dotnet build` + `dotnet test` · `tsc` · `jest` (incl. the **real-sample** import test) · `expo export -p web`.
- [ ] **Flag-OFF byte-identical preserved** (prod with `solver` OFF unchanged).
- [ ] Demo/mock + commercial (billing/AI) paths unaffected.

## 6. Honesty gates (non-negotiable)
- [ ] Tier labels correct everywhere; **no value shown that the data didn't provide**.
- [ ] Illustrative vs solver clearly distinguished in the UI.
- [ ] No fabricated EV/equity/node data anywhere; the only synthetic data remains the **test-only** fixtures.

**When every box is checked, importing the verified pack lights up full EV/equity/node depth automatically (the
inspector + tree already consume the canonical model). Until then: design-only.**
