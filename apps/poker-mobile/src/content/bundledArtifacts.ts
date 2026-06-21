/**
 * Bundled content artifacts — the SINGLE place that `require()`s the generated JSON shipped in the app
 * bundle. Metro needs static literal paths, so the canonical version string lives here (kept in lockstep
 * with `CONTENT_DATASET_VERSION` and `tools/content-export/paths.py`).
 *
 * LAZY: each function `require()`s only when called. Callers (flag-gated stores) invoke them solely when the
 * `content` flag is ON, so production never pulls these into the load path → byte-identical when OFF.
 *
 * ⚠️ The "0.8.1" in the paths below MUST match `CONTENT_DATASET_VERSION`. The drift-guard test
 * (`__tests__/bundledArtifacts.test.ts`) asserts each artifact's internal `dataset_version` matches.
 * On a version bump, update (1) `CONTENT_DATASET_VERSION`, (2) the three literal paths here, and
 * (3) the test-local `require()` paths in grounding/quizIngest/contract tests — all fail loudly if missed
 * (a wrong/stale folder makes `require()` throw or the drift guard mismatch).
 */

/** Coach grounding dataset ({ dataset_version, claims }). */
export function coachGroundingArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/coach_grounding.json');
}

/** Quiz sample ContentPack ({ manifest, schema, rows }). */
export function quizSamplePackArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/quiz_sample.pack.json');
}

/** Analytics contract ({ dataset_version, events }). */
export function analyticsContractArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/analytics_contract.json');
}

/** Pack manifests ContentPack (verification rollups; hard FK → premium_content_catalog). */
export function packManifestsPackArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/pack_manifests.pack.json');
}

/** Premium content catalog ContentPack (access tier + metadata). Bundled WITH pack_manifests (FK pair). */
export function premiumContentCatalogPackArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/premium_content_catalog.pack.json');
}
