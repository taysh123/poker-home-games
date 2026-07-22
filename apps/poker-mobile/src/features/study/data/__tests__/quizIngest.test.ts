/**
 * Quiz ingest integration — proves the FULL bundled quiz bank (0.1: 1,460 free questions,
 * replacing the 30-question quiz_sample) flows end-to-end through the real ContentStore
 * pipeline: validate (incl. content_hash recomputation) → ingest (no quarantine; the bank's
 * hard FK CalibrationProfileID → Calibration_Report resolves against the bundled
 * calibration_report in the SAME set) → query by table → normalize → grade. This is the
 * contract QuizRunnerScreen relies on.
 */
import { createContentStore } from '../../../../content/contentStore';
import { createMemoryBackend } from '../../../../content/memoryBackend';
import { bundledPacks } from '../../../../content/bundledPacks';
import { tableNameFor, type ContentPack } from '../../../../content/types';
import { normalizeQuestions, gradeAnswer } from '../../logic/quiz';

// The real bundled bank (exported by tools/content-export, verbatim workbook rows).
const bankPack = require('../../../../../assets/content/0.8.1/quiz_bank.pack.json') as ContentPack;
const calibrationPack = require('../../../../../assets/content/0.8.1/calibration_report.pack.json') as ContentPack;

describe('bundled quiz bank → ContentStore → quiz logic', () => {
  it('is the full bank, not the sample', () => {
    expect(bankPack.manifest.pack_id).toBe('quiz_bank');
    expect(bankPack.manifest.row_count).toBe(1460);
  });

  it('validates and ingests WITHOUT quarantine (hash + FK resolve against calibration_report)', async () => {
    const store = createContentStore(createMemoryBackend());
    const results = await store.ingest([bankPack, calibrationPack]);
    expect(store.quarantine()).toEqual([]);
    const bank = results.find(r => r.table === 'quiz_bank');
    expect(bank).toMatchObject({ ok: true, quarantined: false });
    expect(bank?.rows).toBe(bankPack.manifest.row_count);
  });

  it('is part of bundledPacks() with exactly one calibration_report in the set (no double-insert)', async () => {
    const packs = bundledPacks();
    const ids = packs.map(p => p.manifest.pack_id);
    expect(ids).toContain('quiz_bank');
    expect(ids).not.toContain('quiz_sample');
    expect(ids.filter(id => id === 'calibration_report')).toHaveLength(1);

    // The WHOLE bundled set ingests with zero quarantines (bank + lessons + catalog together).
    const store = createContentStore(createMemoryBackend());
    await store.ingest(packs);
    expect(store.quarantine()).toEqual([]);
    expect((await store.getAll('quiz_bank')).length).toBe(1460);
    expect((await store.getAll('learning_modules')).length).toBeGreaterThan(0); // lessons unharmed
  });

  it('every bank row round-trips into a valid, gradable question (no silent drops)', async () => {
    const store = createContentStore(createMemoryBackend());
    await store.ingest([bankPack, calibrationPack]);

    const table = tableNameFor(bankPack.manifest.source_sheet);
    expect(table).toBe('quiz_bank');
    const rows = await store.getAll(table);
    expect(rows.length).toBe(1460);

    const questions = normalizeQuestions(rows);
    expect(questions.length).toBe(rows.length);
    for (const q of questions) {
      expect(q.prompt.length).toBeGreaterThan(0);
      expect(q.options.some(o => o.key === q.correct)).toBe(true);
      expect(q.free).toBe(true); // the entire shipped bank is the FREE tier
    }

    const first = questions[0];
    expect(gradeAnswer(first, first.correct).correct).toBe(true);
    const wrong = (['A', 'B', 'C', 'D'] as const).find(c => c !== first.correct)!;
    expect(gradeAnswer(first, wrong).correct).toBe(false);
  });

  it('find() by Category returns a subset', async () => {
    const store = createContentStore(createMemoryBackend());
    await store.ingest([bankPack, calibrationPack]);
    const rows = await store.getAll('quiz_bank');
    const someCategory = String(rows[0].Category);
    const matched = await store.find('quiz_bank', { Category: someCategory });
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every(r => r.Category === someCategory)).toBe(true);
  });
});
