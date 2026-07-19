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

/** Learning modules ContentPack (lesson catalog — 28 modules; free-first opens 3 via FREE_LESSON_MODULE_IDS). */
export function learningModulesPackArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/learning_modules.pack.json');
}

/** Lesson content ContentPack (section text; FK → learning_modules). Bundled WITH learning_modules. */
export function lessonContentPackArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/lesson_content.pack.json');
}

// Referenced-table leaves the lesson packs hard-FK into — MUST be bundled or the lesson packs dangle and
// quarantine ("No lessons yet"). All three are FK-leaves for the bundled set (calibration_report has no FKs;
// coach_knowledge_map's are all soft '(node)'; quiz_learning_objectives → learning_modules, which is bundled).

/** Calibration report ContentPack (learning_modules.CalibrationProfileID → this). */
export function calibrationReportPackArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/calibration_report.pack.json');
}

/** Coach knowledge map ContentPack (lesson_content.LinkedConceptID → this). */
export function coachKnowledgeMapPackArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/coach_knowledge_map.pack.json');
}

/** Quiz learning objectives ContentPack (lesson_content.LinkedObjectiveID → this). */
export function quizLearningObjectivesPackArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/quiz_learning_objectives.pack.json');
}
