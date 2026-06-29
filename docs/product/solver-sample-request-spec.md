# External Solver Sample — Request Spec (design-only, vendor-neutral)

> **Purpose:** define exactly what to obtain from a solver vendor/source so a concrete adapter can map their
> export INTO the T-Poker canonical solver-pack. **We do NOT invent the vendor's format** — we request their
> real export + spec and map it. **No values are fabricated**; tiers are honest. Until a real sample arrives,
> no adapter is built. Canonical reference: `solver-pack-architecture.md` / `solver-import-pipeline.md`.

## 1. Artifacts to collect (the actual "sample")
1. **A real export file** (any format the source produces — JSON/CSV/proprietary) for **≥2 representative
   scenarios** (e.g. one preflop RFI range; one facing-action or postflop node if the source has them). Real
   output, not a hand-made mock.
2. **The format specification / field documentation** for that export (so the adapter is written against a
   documented contract, not guessed).
3. **The solve configuration** that produced it: game tree (bet sizes, raise sizes, cap), rake model,
   abstraction/bucketing, accuracy/exploitability target, board(s) for postflop.
4. **Provenance metadata** (see §4) and the **right-to-use confirmation** (see §6).

## 2. Semantic fields the export MUST contain (mapped to the canonical model)
The export's *shape* is the vendor's; these are the *semantics* the adapter needs to populate a valid pack.

**REQUIRED — to build a minimal valid pack** (maps to `SolverRange` / `HandStrategy` / `ActionFrequency`):
| Need | Canonical target | Notes |
|------|------------------|-------|
| Per-hand action mix with frequencies | `strategy[hand] = ActionFrequency[]` | `freq` in **0..1** (we can normalize from %); actions map to `fold` / `call` / `raise` |
| The hands covered | `HandKey` keys (`AA`, `AKs`, `AKo`) | preflop = the 169-hand grid; per-node = that node's range |
| A stable range identifier | `SolverRange.id` | unique within the pack; stable across re-exports |
| Range context | `format` (cash/mtt), `tableSize`, `stackBb`, `scenario`, `heroPosition` | required for honest labels + the inspector |

**OPTIONAL — light up the richer inspector / tree (rendered ONLY if present)**:
| Need | Canonical target |
|------|------------------|
| Facing context | `villainPosition`, `openSizeBb` |
| Per-action EV (in **big blinds**) | `ActionFrequency.evBb` |
| Per-action / hand equity (**0..1**) | `ActionFrequency.equity` |
| Action sizing (bb) | `ActionFrequency.sizeBb` |
| Decision tree (postflop) | `SolverNode { id, path[], street, parentId?, rangeId? }` + `SolverRange.nodeRefs[]` |
| Baseline/lineage | `manifest.baselinePackId` (for compare mode) |

**We DERIVE (do not send): combo counts** — pure combinatorics (`combos.ts`); never treat them as solver data.

## 3. Units & conventions (so mapping is unambiguous)
- Frequencies: decimal **0..1** (normalize from % if needed); per hand the action mix should sum ≈ 1.
- EV: **big blinds** (state the unit; we store `evBb`). Equity: **0..1**.
- Positions: canonical labels (`UTG/MP/CO/BTN/SB/BB`, table-size-aware).
- Hand keys: canonical `AA` / `AKs` / `AKo`.
- Streets: `preflop|flop|turn|river`.

## 4. Provenance metadata (→ `SolverPackManifest`)
Provide: `solverEngine` (name), `solverVersion`, solve/generation **timestamp**, and the source's own
**export-format version** (→ our `sourceVersion`). We set `schemaVersion` + `importVersion` ourselves. State the
honest **verification tier**: `solver` (genuine solver output) · `calibrated` (human-tuned, solver-informed) ·
`illustrative` (educational). We will NOT label anything `solver` unless it is real solver output.

## 5. Versioning
- The export-format version rides in `sourceVersion`; bumps when the vendor changes their schema (the adapter
  pins supported versions).
- Re-exports of the same solve should be **reproducible/stable** (same content ⇒ same canonical pack ⇒ same
  content hash) so updates are detectable.
- Our `schemaVersion` (canonical) gates structural compatibility; `importVersion` tracks adapter/pipeline changes.

## 6. Hashing & integrity
- **We compute** the canonical `contentHash` (FNV over canonical JSON of manifest-sans-hash + ranges + nodes)
  during import — the vendor does **not** supply ours, and we never trust a vendor-supplied value as our content
  hash.
- If the vendor provides their **own** export checksum/hash, send it — we use it only to verify **transfer
  integrity** of the file before mapping (not as the pack hash).

## 7. Legal / right-to-use checklist (must be satisfied before import)
- [ ] Written license/right to **redistribute this data inside the T Poker app** (web + mobile).
- [ ] Permitted **audience**: may it be shown to free users, premium-only, or both?
- [ ] **Attribution** requirements (if any) — exact text + placement.
- [ ] **Territorial / field-of-use** restrictions (any region or use-case limits?).
- [ ] **Provenance clean**: the source owns/has rights to the underlying ranges (no third-party-copyrighted data
      without rights).
- [ ] **Verification-tier claim** confirmed in writing (is it genuine solver output?).
- [ ] Whether the data may appear in a **future public/shared spot library** (separate consent).
- [ ] A dated, signed confirmation from the rights holder.

## 8. How to verify the sample is usable (acceptance test — no fabrication)
Map a **small real slice** to the canonical model via a draft adapter, then:
- [ ] `prepareImport` → `validatePack` passes (schema, allowed enums, `freq`/`equity` ∈ 0..1, `evBb` finite,
      node tree integrity, no dangling refs).
- [ ] Content hash is stable across two runs (deterministic mapping).
- [ ] Tier is set honestly (`solver` only if genuine); the inspector's "illustrative" note disappears only for
      genuinely solver/calibrated data.
- [ ] EV/equity values are sane (equity 0..1; EV in bb plausible) — spot-checked against the source, **never
      invented**.
- [ ] Node `path`/`parentId`/`rangeId` (if postflop) resolve and form a valid forest.
- [ ] Round-trip: re-importing the same export replaces (same id) with an identical hash.

## 9. What we will NOT do
- Invent or reverse-guess the vendor's export schema.
- Fabricate EV/equity/node values to "fill gaps".
- Mark illustrative/derived data as `solver`-tier.
- Build a concrete adapter before a real sample + format spec + right-to-use are provided.

**Deliver this spec to the solver source; once a real sample + format doc + signed right-to-use arrive, a
vendor-specific adapter can be built against the real format and validated by §8.**
