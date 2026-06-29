/**
 * Lesson presentation logic (PR #3) — PURE. Maps `lesson_content` rows (from the ContentStore) into
 * ordered, render-ready sections. No workbook access; the screen reads rows via `useContent().query` only.
 */
import type { Row } from '../../../content/types';

export interface LessonSection {
  id: string;
  order: number;
  sectionType?: string;
  heading: string;
  body: string;
}

export interface LessonModule {
  moduleId: string;
  moduleName: string;
}

/** `lesson_content` rows → sections ordered by SectionOrder (canonical render order). */
export function sortSections(rows: Row[]): LessonSection[] {
  return rows
    .map(r => ({
      id: String(r['LessonContentID'] ?? ''),
      order: Number(r['SectionOrder'] ?? 0),
      sectionType: r['SectionType'] != null ? String(r['SectionType']) : undefined,
      heading: String(r['Heading'] ?? ''),
      body: String(r['BodyText'] ?? ''),
    }))
    .sort((a, b) => a.order - b.order);
}

/** `learning_modules` rows → module list items. */
export function toModules(rows: Row[]): LessonModule[] {
  return rows.map(r => ({ moduleId: String(r['ModuleID'] ?? ''), moduleName: String(r['ModuleName'] ?? '') }));
}
