/**
 * Quiz logic (PR #5) — PURE, testable. Normalizes raw quiz rows (Quiz_Bank / Quiz_Advanced shape:
 * Question / OptionA–D / CorrectAnswer / Explanation) into a typed question, grades answers, selects
 * a runnable set, and scores a run. No I/O, no React. Rows come from the ContentStore (never the
 * workbook). Malformed rows are dropped, never fabricated into shape.
 *
 * Forward-compat: optional collection / learning-objective / lesson linkage is carried through so a
 * later PR can drive selection from Quiz_Collections / Quiz_Learning_Objectives and feed graded
 * results into the mastery engine — without reshaping this module.
 */
import type { Row } from '../../../content/types';

export type QuizChoice = 'A' | 'B' | 'C' | 'D';
const CHOICES: QuizChoice[] = ['A', 'B', 'C', 'D'];

export interface QuizOption {
  key: QuizChoice;
  text: string;
}

export interface QuizQuestion {
  id: string;
  category: string;
  topic: string;
  difficulty: string;
  prompt: string;
  /** Present options only (empty option columns are dropped); always includes the correct one. */
  options: QuizOption[];
  correct: QuizChoice;
  explanation: string;
  free: boolean;
  /** Forward-compat linkage (often undefined when sourced from Quiz_Bank). */
  collectionId?: string;
  learningObjectiveId?: string;
  lessonId?: string;
}

export interface QuizFilter {
  category?: string;
  difficulty?: string;
  /** Only free questions (for not-yet-entitled users). */
  freeOnly?: boolean;
  limit?: number;
}

export interface GradeResult {
  correct: boolean;
  chosen: QuizChoice;
  correctChoice: QuizChoice;
  explanation: string;
}

export interface QuizScore {
  total: number;
  correct: number;
  /** 0–100, rounded. 0 when total is 0. */
  pct: number;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const trimmed = (v: unknown): string => str(v).trim();

function asChoice(v: unknown): QuizChoice | null {
  const s = trimmed(v).toUpperCase();
  return (CHOICES as string[]).includes(s) ? (s as QuizChoice) : null;
}

/**
 * Normalize one raw row → a QuizQuestion, or `null` if it can't be a valid question:
 * needs an id, a non-empty prompt, a correct answer in A–D, and the correct option's text present.
 */
export function normalizeQuestion(row: Row): QuizQuestion | null {
  const id = trimmed(row.QuizID);
  const prompt = trimmed(row.Question);
  const correct = asChoice(row.CorrectAnswer);
  if (!id || !prompt || !correct) return null;

  const options: QuizOption[] = [];
  for (const key of CHOICES) {
    const text = trimmed(row[`Option${key}`]);
    if (text) options.push({ key, text });
  }
  // The correct option must actually exist among the presented options.
  if (!options.some(o => o.key === correct)) return null;
  if (options.length < 2) return null; // not a real multiple-choice question

  const free = trimmed(row.FreeOrPremium).toLowerCase() === 'free';
  const q: QuizQuestion = {
    id,
    category: trimmed(row.Category),
    topic: trimmed(row.Topic),
    difficulty: trimmed(row.Difficulty),
    prompt,
    options,
    correct,
    explanation: trimmed(row.Explanation),
    free,
  };
  const collectionId = trimmed(row.CollectionID);
  const learningObjectiveId = trimmed(row.LearningObjectiveID);
  const lessonId = trimmed(row.LinkedLessonID);
  if (collectionId) q.collectionId = collectionId;
  if (learningObjectiveId) q.learningObjectiveId = learningObjectiveId;
  if (lessonId) q.lessonId = lessonId;
  return q;
}

/** Normalize many rows, dropping malformed ones (order preserved). */
export function normalizeQuestions(rows: Row[]): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const r of rows) {
    const q = normalizeQuestion(r);
    if (q) out.push(q);
  }
  return out;
}

/** Distinct categories present, in first-seen order. */
export function categoriesOf(questions: QuizQuestion[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of questions) {
    if (q.category && !seen.has(q.category)) {
      seen.add(q.category);
      out.push(q.category);
    }
  }
  return out;
}

/** Select a runnable set by filter (deterministic — preserves source order, no shuffle). */
export function selectQuestions(questions: QuizQuestion[], filter: QuizFilter = {}): QuizQuestion[] {
  let out = questions;
  if (filter.category) out = out.filter(q => q.category === filter.category);
  if (filter.difficulty) out = out.filter(q => q.difficulty === filter.difficulty);
  if (filter.freeOnly) out = out.filter(q => q.free);
  if (typeof filter.limit === 'number' && filter.limit >= 0) out = out.slice(0, filter.limit);
  return out;
}

/**
 * Skill-seeded selection with a pool-size fallback (slice 1.3). Applies the base filter, then
 * the seeded difficulty ONLY when the seeded pool still holds a full run (`minPool`) — an
 * exact-string mismatch or a thin difficulty band must never starve the daily rotation. Pure.
 */
export function selectSeeded(
  questions: QuizQuestion[],
  filter: QuizFilter,
  seededDifficulty: string | null,
  minPool: number,
): QuizQuestion[] {
  const base = selectQuestions(questions, filter);
  if (!seededDifficulty) return base;
  const seeded = base.filter(q => q.difficulty === seededDifficulty);
  return seeded.length >= minPool ? seeded : base;
}

/** Grade a single answer against its question. */
export function gradeAnswer(question: QuizQuestion, chosen: QuizChoice): GradeResult {
  return {
    correct: chosen === question.correct,
    chosen,
    correctChoice: question.correct,
    explanation: question.explanation,
  };
}

/** Aggregate a set of boolean correctness outcomes into a score. */
export function scoreQuiz(outcomes: boolean[]): QuizScore {
  const total = outcomes.length;
  const correct = outcomes.reduce((n, ok) => n + (ok ? 1 : 0), 0);
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { total, correct, pct };
}

export interface CategoryResult {
  category: string;
  correct: number;
  total: number;
}

/**
 * Per-category correct/total for ONE run (questions parallel to outcomes), in first-seen order.
 * This is a THIS-RUN summary only — NOT mastery/progress over time (that needs persisted attempt
 * aggregates + objective linkage, which aren't wired). Honest by scope.
 */
export function runBreakdown(questions: QuizQuestion[], outcomes: boolean[]): CategoryResult[] {
  const byCat = new Map<string, CategoryResult>();
  const order: string[] = [];
  const n = Math.min(questions.length, outcomes.length);
  for (let i = 0; i < n; i++) {
    const category = questions[i].category || 'General';
    let r = byCat.get(category);
    if (!r) { r = { category, correct: 0, total: 0 }; byCat.set(category, r); order.push(category); }
    r.total += 1;
    if (outcomes[i]) r.correct += 1;
  }
  return order.map(c => byCat.get(c)!);
}
