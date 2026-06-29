# 03 — JSON Schema Specification

**Deliverable 3.** The canonical shapes for the broad content model, expressed as JSON Schema (draft 2020-12)
in [`schemas/`](schemas), plus the versioning rules. These schemas are **inert specification files** — no app
code imports them; they are the authoring + CI-validation contract.

---

## 1. Files

| Schema | Describes |
|--------|-----------|
| [`schemas/content-pack.schema.json`](schemas/content-pack.schema.json) | The pack envelope (`manifest` + typed arrays) |
| [`schemas/range-doc.schema.json`](schemas/range-doc.schema.json) | A preflop range (extends today's `PreflopRange`) |
| [`schemas/lesson-doc.schema.json`](schemas/lesson-doc.schema.json) | A concept/lesson (Markdown body + metadata) |
| [`schemas/quiz-doc.schema.json`](schemas/quiz-doc.schema.json) | An authored quiz (ordered questions) |
| [`schemas/learning-path-doc.schema.json`](schemas/learning-path-doc.schema.json) | An ordered learning path (steps + unlock rules) |
| [`schemas/coach-knowledge-doc.schema.json`](schemas/coach-knowledge-doc.schema.json) | A server-resident coach knowledge entry |

A synthetic, illustrative pack that validates against all of these lives at
[`examples/example-pack.json`](examples/example-pack.json) (**not** workbook content).

## 2. Envelope: `ContentPack`

```jsonc
{
  "manifest": {
    "id": "gto-cash-6max-core",      // stable pack id (kebab-case)
    "version": "1.0.0",              // content semver (changes when content changes)
    "schemaVersion": 1,              // shape version (changes when structure changes)
    "name": "Cash 6-max Core",
    "locale": "en",
    "isIllustrative": false,          // mirrors RangeDataset.isIllustrative
    "entitlements": ["advanced_gto"], // PremiumFeatureKey[]; [] = free
    "minAppVersion": "1.4.0",        // optional; older apps skip incompatible packs
    "checksum": "sha256:…",          // set by the build pipeline (02 §D)
    "signature": "…",                // optional; release-key signature of checksum
    "createdAt": "2026-01-01T00:00:00Z"
  },
  "ranges":    [ /* RangeDoc[] */ ],
  "lessons":   [ /* LessonDoc[] */ ],
  "quizzes":   [ /* QuizDoc[] */ ],
  "paths":     [ /* LearningPathDoc[] */ ],
  "knowledge": [ /* CoachKnowledgeDoc[] */ ]
}
```
All five content arrays are **optional** — a pack may carry only ranges, only lessons, etc.

## 3. `RangeDoc` (compatible with today's trainer)

A superset of `PreflopRange` (`apps/poker-mobile/src/features/study/types.ts`), so existing consumers
(`generateSpot`/`evaluateSpot`, `buildTrainerHand`) work unchanged:

```jsonc
{
  "id": "rfi-co-6max-100",
  "format": "cash",                  // 'cash' | 'mtt'
  "tableSize": 6,
  "stackBb": 100,
  "scenario": "RFI",                 // open string; 'RFI'|'vs_RFI' today, extensible (3bet, vs_3bet, …)
  "heroPosition": "CO",
  "villainPosition": "BTN",          // optional
  "openSizeBb": 2.5,                  // optional
  "label": "CO open · 6-max 100bb",
  "tags": ["preflop", "rfi"],        // optional, additive
  "strategy": {                       // HandKey -> ActionFrequency[]
    "AA": [{ "action": "raise", "freq": 1 }],
    "T9s": [{ "action": "raise", "freq": 0.6 }, { "action": "call", "freq": 0.4 }]
  }
}
```
- `HandKey` pattern: `^[2-9TJQKA]{2}[so]?$` (e.g. `AA`, `AKs`, `AKo`).
- `ActionFrequency.freq` ∈ [0,1]; per-hand frequencies should sum to ≈1 (CI checks ±1e-6).
- `action` is an **open string** (recommended set `fold|call|raise|check|allin`) so future actions don't break
  older validators; the app maps unknown actions to a safe default.

## 4. `LessonDoc`, `QuizDoc`, `LearningPathDoc`, `CoachKnowledgeDoc`

See the schema files for the authoritative shapes. Summary:

- **LessonDoc** — `{ id, title, body (Markdown), tags?, estMinutes?, mediaRefs?[] }`.
- **QuizDoc** — `{ id, title, passThresholdPct?, questions: QuizQuestion[] }` where a `QuizQuestion` is either a
  `range_spot` (`rangeId` + `hand`, graded by the existing mixed-frequency rule) or a `multiple_choice`
  (`choices[]` + `correctIndex`); both may carry `explanation` and optional `correctActions[]`.
- **LearningPathDoc** — `{ id, title, steps: PathStep[] }` where each `PathStep` has `ref { type:
  'lesson'|'quiz'|'range_drill', id }` and optional `unlock { type: 'always'|'min_quiz_pct', quizId?, pct? }`.
- **CoachKnowledgeDoc** — `{ id, topic, concept (Markdown), appliesTo? { scenario?, position?, street? },
  rangeRefs?[], tags? }`. Server-resident (see [05](05-coach-knowledge-integration.md)).

Cross-references are **by id** within a pack (a quiz question's `rangeId`, a path step's `ref.id`, a knowledge
doc's `rangeRefs`). The build CLI ([02](02-import-pipeline-design.md) §B/C) verifies every reference resolves.

## 5. Versioning rules

Two independent version axes:

| Axis | Field | Bumps when | Consumer behavior |
|------|-------|-----------|-------------------|
| **Content** | `manifest.version` (semver) | The content changes (new/edited ranges, fixed strategy) | Device re-downloads the new immutable version (02 §3) |
| **Shape** | `schemaVersion` (integer, per pack + reused per doc where needed) | The *structure* changes | App runs a migration chain on load |

Policy:
- **Additive-only within a major `schemaVersion`.** New optional fields/new content-type arrays/new enum-ish
  string values must not require a bump. Schemas are **tolerant**: unknown fields are ignored (no
  `additionalProperties:false` at doc level), so a newer pack stays *forward-compatible* with an older app
  (it renders what it understands, skips the rest).
- **Breaking changes bump the major `schemaVersion`** and add a migration step mirroring
  `migrateToCurrent()` in `src/local/localGamesStore.ts` / `src/features/study/data/studyStore.ts`.
- `minAppVersion` guards content that genuinely needs new app capabilities; older apps skip such packs.
- The current `RangeDataset.schemaVersion: 1` remains valid; `ContentPack` is a *new* envelope around the same
  `RangeDoc` shape, so the existing study path is unaffected until the loader seam is introduced ([06](06-migration-plan.md)).

## 6. Validation
CI validates every authored pack against these schemas plus semantic checks (referential integrity, frequency
sums, known entitlement keys). See [02](02-import-pipeline-design.md) §C. The example fixture in this folder is
validated as part of this task's verification.
