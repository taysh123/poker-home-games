/**
 * Quiz logic tests (PR #5) — normalization, grading, selection, scoring. Pure; no I/O.
 */
import {
  normalizeQuestion,
  normalizeQuestions,
  gradeAnswer,
  selectQuestions,
  scoreQuiz,
  categoriesOf,
  runBreakdown,
  type QuizQuestion,
} from '../quiz';
import type { Row } from '../../../../content/types';

const rawRow = (over: Partial<Row> = {}): Row => ({
  QuizID: 'Q1',
  Category: 'RFI',
  Topic: 'UTG 100bb',
  Difficulty: 'Beginner',
  Question: 'It folds to you UTG with AA. Best action?',
  OptionA: 'Shove',
  OptionB: 'Raise (open)',
  OptionC: 'Fold',
  OptionD: 'Limp',
  CorrectAnswer: 'B',
  Explanation: 'AA opens for value from any seat.',
  FreeOrPremium: 'Free',
  ...over,
});

describe('normalizeQuestion', () => {
  it('maps a well-formed row into a typed question', () => {
    const q = normalizeQuestion(rawRow())!;
    expect(q.id).toBe('Q1');
    expect(q.correct).toBe('B');
    expect(q.options.map(o => o.key)).toEqual(['A', 'B', 'C', 'D']);
    expect(q.free).toBe(true);
  });

  it('lower-cases/ trims FreeOrPremium and accepts lowercase CorrectAnswer', () => {
    const q = normalizeQuestion(rawRow({ CorrectAnswer: 'c', FreeOrPremium: 'Premium' }))!;
    expect(q.correct).toBe('C');
    expect(q.free).toBe(false);
  });

  it('drops empty option columns but keeps the correct one', () => {
    const q = normalizeQuestion(rawRow({ OptionD: '', CorrectAnswer: 'A' }))!;
    expect(q.options.map(o => o.key)).toEqual(['A', 'B', 'C']);
  });

  it('returns null when prompt / id / correct answer is missing or invalid', () => {
    expect(normalizeQuestion(rawRow({ Question: '' }))).toBeNull();
    expect(normalizeQuestion(rawRow({ QuizID: '' }))).toBeNull();
    expect(normalizeQuestion(rawRow({ CorrectAnswer: 'E' }))).toBeNull();
  });

  it('returns null when the correct option text is absent (CorrectAnswer points to an empty option)', () => {
    expect(normalizeQuestion(rawRow({ OptionB: '', CorrectAnswer: 'B' }))).toBeNull();
  });

  it('returns null when fewer than two options exist', () => {
    expect(normalizeQuestion(rawRow({ OptionB: '', OptionC: '', OptionD: '', CorrectAnswer: 'A' }))).toBeNull();
  });

  it('carries forward-compat linkage when present', () => {
    const q = normalizeQuestion(rawRow({ CollectionID: 'QCOL-01', LearningObjectiveID: 'LO-001', LinkedLessonID: 'CK-002' }))!;
    expect(q.collectionId).toBe('QCOL-01');
    expect(q.learningObjectiveId).toBe('LO-001');
    expect(q.lessonId).toBe('CK-002');
  });
});

describe('normalizeQuestions / categoriesOf', () => {
  const qs = normalizeQuestions([
    rawRow({ QuizID: 'Q1', Category: 'RFI' }),
    rawRow({ QuizID: 'Q2', Category: 'ICM' }),
    rawRow({ QuizID: 'Q3', Question: '' }), // dropped
    rawRow({ QuizID: 'Q4', Category: 'RFI' }),
  ]);
  it('drops malformed rows', () => {
    expect(qs.map(q => q.id)).toEqual(['Q1', 'Q2', 'Q4']);
  });
  it('lists distinct categories in first-seen order', () => {
    expect(categoriesOf(qs)).toEqual(['RFI', 'ICM']);
  });
});

describe('gradeAnswer', () => {
  const q = normalizeQuestion(rawRow())!;
  it('marks the correct choice correct, with the explanation', () => {
    const g = gradeAnswer(q, 'B');
    expect(g).toMatchObject({ correct: true, chosen: 'B', correctChoice: 'B' });
    expect(g.explanation).toMatch(/value/);
  });
  it('marks a wrong choice incorrect but still reveals the correct one', () => {
    const g = gradeAnswer(q, 'C');
    expect(g.correct).toBe(false);
    expect(g.correctChoice).toBe('B');
  });
});

describe('selectQuestions', () => {
  const qs: QuizQuestion[] = normalizeQuestions([
    rawRow({ QuizID: 'Q1', Category: 'RFI', Difficulty: 'Beginner', FreeOrPremium: 'Free' }),
    rawRow({ QuizID: 'Q2', Category: 'ICM', Difficulty: 'Intermediate', FreeOrPremium: 'Premium' }),
    rawRow({ QuizID: 'Q3', Category: 'RFI', Difficulty: 'Intermediate', FreeOrPremium: 'Free' }),
  ]);
  it('filters by category / difficulty / free and applies a limit (deterministic order)', () => {
    expect(selectQuestions(qs, { category: 'RFI' }).map(q => q.id)).toEqual(['Q1', 'Q3']);
    expect(selectQuestions(qs, { difficulty: 'Intermediate' }).map(q => q.id)).toEqual(['Q2', 'Q3']);
    expect(selectQuestions(qs, { freeOnly: true }).map(q => q.id)).toEqual(['Q1', 'Q3']);
    expect(selectQuestions(qs, { limit: 2 }).map(q => q.id)).toEqual(['Q1', 'Q2']);
    expect(selectQuestions(qs, {}).length).toBe(3);
  });
});

describe('scoreQuiz', () => {
  it('aggregates correctness into total/correct/pct', () => {
    expect(scoreQuiz([true, false, true, true])).toEqual({ total: 4, correct: 3, pct: 75 });
    expect(scoreQuiz([])).toEqual({ total: 0, correct: 0, pct: 0 });
    expect(scoreQuiz([false, false])).toEqual({ total: 2, correct: 0, pct: 0 });
  });
});

describe('runBreakdown — this-run per-category summary', () => {
  const qs = normalizeQuestions([
    rawRow({ QuizID: 'Q1', Category: 'RFI' }),
    rawRow({ QuizID: 'Q2', Category: 'ICM' }),
    rawRow({ QuizID: 'Q3', Category: 'RFI' }),
  ]);
  it('tallies correct/total per category in first-seen order', () => {
    expect(runBreakdown(qs, [true, false, true])).toEqual([
      { category: 'RFI', correct: 2, total: 2 },
      { category: 'ICM', correct: 0, total: 1 },
    ]);
  });
  it('handles empty + mismatched lengths safely', () => {
    expect(runBreakdown([], [])).toEqual([]);
    expect(runBreakdown(qs, [true])).toEqual([{ category: 'RFI', correct: 1, total: 1 }]);
  });
});
