import { sortSections, toModules, lessonAvailability } from '../lessons';
import { FREE_LESSON_MODULE_IDS } from '../../config';
import { createContentStore } from '../../../../content/contentStore';
import { createMemoryBackend } from '../../../../content/memoryBackend';
import { makePack } from '../../../../content/__tests__/fixtures';
import type { SchemaColumn, Row } from '../../../../content/types';

describe('sortSections', () => {
  it('orders by SectionOrder and maps fields', () => {
    const rows: Row[] = [
      { LessonContentID: 'LC-2', SectionOrder: 2, SectionType: 'KeyNumbers', Heading: 'B', BodyText: '## b' },
      { LessonContentID: 'LC-1', SectionOrder: 1, SectionType: 'Overview', Heading: 'A', BodyText: '# a' },
    ];
    const out = sortSections(rows);
    expect(out.map(s => s.id)).toEqual(['LC-1', 'LC-2']);
    expect(out[0]).toMatchObject({ order: 1, sectionType: 'Overview', heading: 'A', body: '# a' });
  });
  it('handles missing fields gracefully', () => {
    expect(sortSections([{ LessonContentID: 'X' }])[0]).toMatchObject({ id: 'X', order: 0, heading: '', body: '' });
  });
});

describe('lessonAvailability (free-first: FREE_LESSON_MODULE_IDS wins)', () => {
  it('pins the launch set to the 3 zero-prerequisite starters', () => {
    expect(FREE_LESSON_MODULE_IDS).toEqual(['LM-01', 'LM-05', 'LM-04']);
  });

  it('opens exactly the free-listed modules for free users', () => {
    for (const id of FREE_LESSON_MODULE_IDS) expect(lessonAvailability(id, false)).toBe('available');
  });

  it('locks everything else for free users (incl. workbook-Free LM-02/LM-06)', () => {
    for (const id of ['LM-02', 'LM-06', 'LM-03', 'LM-15', '']) expect(lessonAvailability(id, false)).toBe('locked');
  });

  it('premium opens all modules', () => {
    expect(lessonAvailability('LM-15', true)).toBe('available');
    expect(lessonAvailability('LM-02', true)).toBe('available');
  });
});

describe('toModules', () => {
  it('maps ModuleID/ModuleName', () => {
    expect(toModules([{ ModuleID: 'LM-01', ModuleName: 'Opens' }])).toEqual([{ moduleId: 'LM-01', moduleName: 'Opens' }]);
  });
});

describe('Lesson Reader reads through the ContentStore (no direct workbook access)', () => {
  const lessonsSchema: SchemaColumn[] = [
    { column: 'LessonContentID', datatype: 'string', required: 'Y' },
    { column: 'ModuleID', datatype: 'string', required: 'Y' },
    { column: 'SectionOrder', datatype: 'int', required: 'Y' },
    { column: 'Heading', datatype: 'string', required: 'Y' },
    { column: 'BodyText', datatype: 'string', required: 'Y' },
  ];
  it('ingests a lesson pack and serves ordered sections for a module', async () => {
    const store = createContentStore(createMemoryBackend());
    const pack = makePack({
      packId: 'pack.lessons', sheet: 'Lesson_Content', schema: lessonsSchema,
      rows: [
        { LessonContentID: 'LC-0002', ModuleID: 'LM-01', SectionOrder: 2, Heading: 'Key numbers', BodyText: '...' },
        { LessonContentID: 'LC-0001', ModuleID: 'LM-01', SectionOrder: 1, Heading: 'Overview', BodyText: '# Hi' },
        { LessonContentID: 'LC-0003', ModuleID: 'LM-02', SectionOrder: 1, Heading: 'Other', BodyText: 'x' },
      ],
    });
    const res = await store.ingest([pack]);
    expect(res[0].ok).toBe(true);
    const rows = await store.find('lesson_content', { ModuleID: 'LM-01' });
    const sections = sortSections(rows);
    expect(sections.map(s => s.id)).toEqual(['LC-0001', 'LC-0002']); // ordered, filtered to LM-01
  });
});
