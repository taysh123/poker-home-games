/**
 * Bundled content packs — the in-app set the ContentStore ingests when the `content` flag is ON.
 *
 * The FULL free quiz bank (1,460 questions, 0.1) + the pack catalog pair + the lesson set. The whole
 * array is ingested as ONE cross-resolving set, so FK leaves must appear exactly once:
 * calibration_report is pushed first because BOTH the quiz bank (CalibrationProfileID) and the lesson
 * packs hard-FK into it — pushing it inside either dependent block would double-insert or dangle.
 * require() is inside the functions so nothing is pulled into the bundle's load path until bootstrap
 * (itself flag-gated) calls this; a missing artifact → that pack/group is skipped, honest empty state.
 */
import type { ContentPack } from './types';
import {
  quizBankPackArtifact,
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

  // Shared FK leaf FIRST, exactly once — the quiz bank and the lesson set both resolve against it.
  let calibrationBundled = false;
  try {
    packs.push(calibrationReportPackArtifact() as ContentPack);
    calibrationBundled = true;
  } catch {
    /* no calibration leaf → the dependent groups below are skipped (they would dangle + quarantine) */
  }

  // Full free quiz bank (0.1). Requires calibration_report in the same set.
  if (calibrationBundled) {
    try {
      packs.push(quizBankPackArtifact() as ContentPack);
    } catch {
      /* bank not bundled → no quizzes (runner shows an honest empty state) */
    }
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

  // Lesson set (free-first) — modules + section text + the remaining leaf tables their hard FKs resolve
  // against (coach_knowledge_map, quiz_learning_objectives; calibration_report is already in the set).
  // All-or-nothing: without the leaves, learning_modules/lesson_content dangle and quarantine
  // ("No lessons yet"). See lessonIngest.test.ts.
  if (calibrationBundled) {
    try {
      const modules = learningModulesPackArtifact() as ContentPack;
      const lessons = lessonContentPackArtifact() as ContentPack;
      const knowledge = coachKnowledgeMapPackArtifact() as ContentPack;
      const objectives = quizLearningObjectivesPackArtifact() as ContentPack;
      packs.push(modules, lessons, knowledge, objectives);
    } catch {
      /* lesson packs not bundled → Lessons shows the honest empty state */
    }
  }
  return packs;
}
