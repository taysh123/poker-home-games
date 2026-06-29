# Solver Import Pipeline (Deliverable C)

> **Status: built (pure pipeline + store + tests).** FAIL-CLOSED, quarantine-never-lose, vendor-neutral. No
> concrete external adapter is invented — future adapters require a real export sample/spec. No fabricated values.

## Flow
```
raw export ─▶ selectAdapter(raw) ─▶ adapter.toPack(raw) ─▶ validatePack ─▶ contentHash check
                    │                      │                    │                │
                 (none)               (throws)             (errors)          (mismatch)
                    └──────────────────────┴────────────────────┴────────────────┴──▶ QUARANTINE (timestamped key)
                                                                                  │
                                                                       all pass ──▶ PROMOTE (replace same id)
```
- **`prepareImport(raw)`** (`pack/importPack.ts`) is pure (no storage): pick adapter → convert → validate. Returns `{ ok, pack?, errors[] }`. Any missing adapter / conversion throw / validation error ⇒ `ok:false`.
- **`importAndStore(raw)`** (`data/solverPackStore.ts`) wraps it: on success **promote** (AsyncStorage, replacing a same-`id` pack); on failure **quarantine** the raw input to `tpoker.solverPacks.quarantine.<ts>` (never silently dropped — mirrors `local/localGamesStore.ts`). A corrupt store file is itself quarantined + reset.

## Validation (fail-closed) — `pack/validate.ts`
Schema shape · required manifest fields · `schemaVersion` supported · `verificationTier` ∈ allowed · per-action `action` ∈ {fold,call,raise} + `freq`/`equity` in [0,1] · **node/tree integrity** (unique ids, valid streets, no dangling `parentId`, no cycles, `nodeRefs` resolve) · **contentHash match**. Returns every error; never throws.

## Adapter seam (vendor-neutral) — `pack/adapters.ts`
`SolverAdapter { id, canHandle(raw), toPack(raw) }`. Today only `identityAdapter` (already-canonical passthrough). Future: register a `gtoWizardAdapter` / `pioSolverAdapter` / `gtoPlusAdapter` / `monkerAdapter` / `customAdapter` in `ADAPTERS` **once a real export sample is provided** — the importer converts each into the canonical pack, then the same validation/quarantine/promote flow applies. **Do not invent an external format.**

## Tests
- `pack/__tests__/pack.test.ts` — hash determinism + key-order independence; validate accepts valid / rejects invalid-shape / tampered (hash mismatch) / dangling-node; adapter selection; prepareImport promote/reject.
- `data/__tests__/solverPackStore.test.ts` — promote valid; quarantine invalid (not promoted; quarantine key written); same-id replace.
- Fixtures are **test-only** (`pack/__fixtures__/`), never shipped.

## Future solver-pack ecosystem (documented, not built)
Pack distribution (bundled vs server-delivered), entitlement gating (premium packs), version upgrades, and signed provenance build on this canonical contract additively — see `public-spot-library-architecture.md` for the related sharing model. All future + flag-gated.

## External dependency (K)
A concrete external adapter needs the **exact export format/sample** from that solver (GTOW/Pio/GTO+/Monker/custom). Ask for it at build time; never reverse-invent it.
