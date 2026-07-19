/**
 * Bundled-artifact version drift guard. Every JSON artifact shipped under assets/content/<v>/ must declare
 * the same `dataset_version` as `CONTENT_DATASET_VERSION` (and the literal require() paths in
 * bundledArtifacts.ts must point at that folder). If a version bump is half-finished, this fails loudly.
 */
import { CONTENT_DATASET_VERSION } from '../datasetVersion';
import {
  coachGroundingArtifact,
  quizSamplePackArtifact,
  analyticsContractArtifact,
  packManifestsPackArtifact,
  premiumContentCatalogPackArtifact,
  learningModulesPackArtifact,
  lessonContentPackArtifact,
  calibrationReportPackArtifact,
  coachKnowledgeMapPackArtifact,
  quizLearningObjectivesPackArtifact,
} from '../bundledArtifacts';

describe('bundled artifacts ↔ CONTENT_DATASET_VERSION', () => {
  it('coach grounding dataset_version matches', () => {
    expect((coachGroundingArtifact() as { dataset_version: string }).dataset_version).toBe(CONTENT_DATASET_VERSION);
  });
  it('analytics contract dataset_version matches', () => {
    expect((analyticsContractArtifact() as { dataset_version: string }).dataset_version).toBe(CONTENT_DATASET_VERSION);
  });
  it('quiz sample pack manifest dataset_version matches', () => {
    expect((quizSamplePackArtifact() as { manifest: { dataset_version: string } }).manifest.dataset_version)
      .toBe(CONTENT_DATASET_VERSION);
  });
  it('pack_manifests pack manifest dataset_version matches', () => {
    expect((packManifestsPackArtifact() as { manifest: { dataset_version: string } }).manifest.dataset_version)
      .toBe(CONTENT_DATASET_VERSION);
  });
  it('premium_content_catalog pack manifest dataset_version matches', () => {
    expect((premiumContentCatalogPackArtifact() as { manifest: { dataset_version: string } }).manifest.dataset_version)
      .toBe(CONTENT_DATASET_VERSION);
  });
  it('learning_modules pack manifest dataset_version matches', () => {
    expect((learningModulesPackArtifact() as { manifest: { dataset_version: string } }).manifest.dataset_version)
      .toBe(CONTENT_DATASET_VERSION);
  });
  it('lesson_content pack manifest dataset_version matches', () => {
    expect((lessonContentPackArtifact() as { manifest: { dataset_version: string } }).manifest.dataset_version)
      .toBe(CONTENT_DATASET_VERSION);
  });
  it('calibration_report pack manifest dataset_version matches', () => {
    expect((calibrationReportPackArtifact() as { manifest: { dataset_version: string } }).manifest.dataset_version)
      .toBe(CONTENT_DATASET_VERSION);
  });
  it('coach_knowledge_map pack manifest dataset_version matches', () => {
    expect((coachKnowledgeMapPackArtifact() as { manifest: { dataset_version: string } }).manifest.dataset_version)
      .toBe(CONTENT_DATASET_VERSION);
  });
  it('quiz_learning_objectives pack manifest dataset_version matches', () => {
    expect((quizLearningObjectivesPackArtifact() as { manifest: { dataset_version: string } }).manifest.dataset_version)
      .toBe(CONTENT_DATASET_VERSION);
  });
});
