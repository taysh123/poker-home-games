/**
 * Bundled content packs — the in-app set the ContentStore ingests when the `content` flag is ON.
 *
 * Currently: a quiz SAMPLE (verbatim Quiz_Bank cross-section, PR #5) + the pack catalog pair
 * (`pack_manifests` + `premium_content_catalog`, PR #6). The full quiz set (~4.5 MB) and other packs are
 * a deferred bundling decision. require() is inside the function so nothing is pulled into the bundle's
 * load path until bootstrap (itself flag-gated) calls this; a missing artifact → that pack is skipped.
 */
import type { ContentPack } from './types';
import {
  quizSamplePackArtifact,
  packManifestsPackArtifact,
  premiumContentCatalogPackArtifact,
  learningModulesPackArtifact,
  lessonContentPackArtifact,
  calibrationReportPackArtifact,
  coachKnowledgeMapPackArtifact,
  quizLearningObjectivesPackArtifact,
} from './bundledArtifacts';

// Gated by the caller: the only invoker is bootstrapContent(), which returns early when the `content`
// flag is OFF — so this (and its require()) never runs in production. Keep that contract if adding callers.
export function bundledPacks(): ContentPack[] {
  const packs: ContentPack[] = [];
  try {
    packs.push(quizSamplePackArtifact() as ContentPack);
  } catch {
    /* artifact not bundled → no quizzes (runner shows an honest empty state) */
  }
  // Pack catalog pair — ingest together so the hard FK pack_manifests.PackID → Premium_Content_Catalog
  // resolves in one set. Both-or-neither: if either is missing, skip both (a lone manifest would quarantine).
  try {
    const manifests = packManifestsPackArtifact() as ContentPack;
    const catalog = premiumContentCatalogPackArtifact() as ContentPack;
    packs.push(catalog, manifests);
  } catch {
    /* pack catalog not bundled → catalog screen shows an honest empty state */
  }
  // Lesson set (free-first) — modules + section text + the leaf tables their hard FKs resolve against
  // (calibration_report, coach_knowledge_map, quiz_learning_objectives). All-or-nothing: without the leaves,
  // learning_modules/lesson_content dangle and quarantine ("No lessons yet"). See lessonIngest.test.ts.
  try {
    const modules = learningModulesPackArtifact() as ContentPack;
    const lessons = lessonContentPackArtifact() as ContentPack;
    const calibration = calibrationReportPackArtifact() as ContentPack;
    const knowledge = coachKnowledgeMapPackArtifact() as ContentPack;
    const objectives = quizLearningObjectivesPackArtifact() as ContentPack;
    packs.push(modules, lessons, calibration, knowledge, objectives);
  } catch {
    /* lesson packs not bundled → Lessons shows the honest empty state */
  }
  return packs;
}
