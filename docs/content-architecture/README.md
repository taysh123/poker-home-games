# T Poker — Content Architecture

Architecture preparation for importing a large external **commercial content workbook** into T Poker.

> **Status: design only.** Nothing here imports workbook content, changes app/backend code, or alters
> production behavior. These documents define the seams, schemas, and rollout so the content team can author
> against a stable target while the workbook is finalized in parallel.

## Confirmed direction

1. **Hybrid delivery + gating.** The free `STARTER_DATASET` stays bundled (offline fallback). Commercial
   content ships as **server-delivered, entitlement-gated content packs**, downloaded and cached on-device.
2. **Broad content model.** A single `ContentPack` envelope carries multiple content types: **ranges,
   lessons/concepts, quizzes, learning paths, and coach-knowledge** entries.

## Documents

| # | Document | Deliverable |
|---|----------|-------------|
| 01 | [Content Architecture Review](01-content-architecture-review.md) | Content Architecture Review |
| 02 | [Import Pipeline Design](02-import-pipeline-design.md) | Import Pipeline Design |
| 03 | [JSON Schema Specification](03-json-schema-specification.md) | JSON Schema Specification |
| 04 | [Content Pack Specification](04-content-pack-specification.md) | Content Pack Specification |
| 05 | [Coach Knowledge Integration Plan](05-coach-knowledge-integration.md) | Coach Knowledge Integration Plan |
| 06 | [Migration Plan: STARTER_DATASET → Commercial](06-migration-plan.md) | Migration Plan |

Supporting assets: [`schemas/`](schemas) (JSON Schema, draft 2020-12) · [`examples/example-pack.json`](examples/example-pack.json)
(synthetic illustrative fixture used to validate the schemas — **not** workbook content).

## Required topics → where each is covered

| Topic | Covered in |
|-------|-----------|
| Content import architecture | 02 |
| JSON schema architecture | 03 + `schemas/` |
| Dataset versioning | 03 (§Versioning), 04 (§Update strategy) |
| Content pack architecture | 04 |
| Premium content gating architecture | 04 (§Gating) |
| Local bundle vs server-delivered content | 04 (§Delivery) |
| Future update strategy | 04 (§Update strategy) |
| Coach knowledge retrieval architecture | 05 |
| Quiz content architecture | 01 (§Quiz), 03 (`QuizDoc`) |
| Learning-path architecture | 01 (§Learning paths), 03 (`LearningPathDoc`) |

## Design principles (non-negotiable, inherited from the codebase)

- **Additive + reversible + flag-gated.** Production behavior is byte-identical until a flag flips. Mirrors the
  existing feature-flag switchboard (`src/config/features.ts`).
- **Fail-closed.** Unknown entitlement/content state resolves to *free / no access*, never an accidental
  unlock. Mirrors `resolveEntitlement` (`src/features/premium/entitlementResolve.ts`).
- **Never destroy user data.** Corrupt/incompatible payloads are quarantined, not cleared. Mirrors
  `src/local/localGamesStore.ts`.
- **Reuse existing seams.** The Study `RangeDataset` import format, the Coach provider abstraction, the
  entitlements gating primitive, and the versioned-store pattern already exist — extend, don't replace.
- **Commercial IP stays protected.** Premium/commercial content is server-delivered and (for coach knowledge)
  server-resident; it is not shipped in the app binary.
