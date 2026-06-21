/**
 * Canonical bundled content dataset version (single source of truth for the app side).
 *
 * Bump this in lockstep with: the `assets/content/<v>/` folder, the literal paths in `bundledArtifacts.ts`
 * (Metro requires static `require()` literals, so the version appears there too), and `RELEASE` in
 * `tools/content-export/paths.py`. The drift-guard test asserts every bundled artifact's internal
 * `dataset_version` equals this constant, so a half-finished bump fails loudly.
 */
export const CONTENT_DATASET_VERSION = '0.8.1';
