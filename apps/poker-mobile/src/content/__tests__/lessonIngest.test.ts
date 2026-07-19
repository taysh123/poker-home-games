import { createContentStore } from '../contentStore';
import { createMemoryBackend } from '../memoryBackend';
import { bundledPacks } from '../bundledPacks';
import { FREE_LESSON_MODULE_IDS } from '../../features/study/config';

/**
 * Regression: the bundled lesson packs must actually INGEST (not silently quarantine) so the Lessons
 * screen shows modules. learning_modules + lesson_content carry hard FKs to calibration_report /
 * coach_knowledge_map / quiz_learning_objectives — those referenced tables MUST be bundled too, or the
 * lesson packs dangle and Lessons shows "No lessons yet" (the production bug fixed here).
 */
describe('bundled lesson ingestion', () => {
  it('ingests learning_modules with no lesson-pack quarantine', async () => {
    const store = createContentStore(createMemoryBackend());
    await store.ingest(bundledPacks());

    const lessonQuarantine = store.quarantine().filter(q =>
      q.packId === 'learning_modules' || q.packId === 'lesson_content');
    expect(lessonQuarantine).toEqual([]); // neither lesson pack may be quarantined

    const modules = await store.getAll('learning_modules');
    expect(modules.length).toBeGreaterThan(0);
  });

  it('exposes the 3 free starter lessons in the ingested modules', async () => {
    const store = createContentStore(createMemoryBackend());
    await store.ingest(bundledPacks());
    const ids = new Set((await store.getAll('learning_modules')).map(r => String(r.ModuleID)));
    for (const id of FREE_LESSON_MODULE_IDS) expect(ids.has(id)).toBe(true);
  });
});
