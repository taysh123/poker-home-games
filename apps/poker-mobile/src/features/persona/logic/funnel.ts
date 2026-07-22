/**
 * Quiet Luxury funnel engine (Wave 1, slice 1.1) — PURE, testable. Owns the step order, the
 * option catalogs (copy lives HERE so the screen stays dumb and the ids stay typed), answer
 * application, and the goal-driven router ordering. Callers pass `now` — no Date.now here.
 */
import type { Persona, PersonaGoal, PersonaSkill, PersonaFormat } from '../types';

export const FUNNEL_STEPS = ['promise', 'goal', 'skill', 'format', 'name'] as const;
export type QuizStep = (typeof FUNNEL_STEPS)[number];

export function nextStep(step: QuizStep): QuizStep | 'router' {
  const i = FUNNEL_STEPS.indexOf(step);
  return i >= 0 && i < FUNNEL_STEPS.length - 1 ? FUNNEL_STEPS[i + 1] : 'router';
}

export function prevStep(step: QuizStep): QuizStep | null {
  const i = FUNNEL_STEPS.indexOf(step);
  return i > 0 ? FUNNEL_STEPS[i - 1] : null;
}

export interface FunnelOption<Id extends string = string> {
  id: Id;
  label: string;
  sub?: string;
}

export const GOAL_OPTIONS: FunnelOption<PersonaGoal>[] = [
  { id: 'host', label: 'I host the game', sub: 'Run the nights, settle up clean' },
  { id: 'improve', label: 'I want to win more', sub: 'Study, drill, plug the leaks' },
  { id: 'both', label: 'Both, honestly', sub: 'Run the table and beat it' },
];

export const SKILL_OPTIONS: FunnelOption<PersonaSkill>[] = [
  { id: 'new', label: 'Newer to poker', sub: 'Still learning the fundamentals' },
  { id: 'solid', label: 'I hold my own', sub: 'Comfortable, want an edge' },
  { id: 'grinder', label: 'Been grinding for years', sub: 'Serious about my game' },
];

export const FORMAT_OPTIONS: FunnelOption<PersonaFormat>[] = [
  { id: 'cash', label: 'Cash games', sub: 'Deep stacks, real decisions' },
  { id: 'tournament', label: 'Tournaments', sub: 'Blinds, bubbles, and ICM' },
  { id: 'both', label: 'Both', sub: 'Whatever the night brings' },
];

const inCatalog = <Id extends string>(options: FunnelOption<Id>[], id: string): id is Id =>
  options.some(o => o.id === id);

/** Apply one step's answer. Unknown ids are ignored (defensive — the UI only passes catalog ids). */
export function applyAnswer(p: Persona, step: QuizStep, answer: string, now: string): Persona {
  switch (step) {
    case 'goal':
      return inCatalog(GOAL_OPTIONS, answer) ? { ...p, goal: answer, updatedAt: now } : p;
    case 'skill':
      return inCatalog(SKILL_OPTIONS, answer) ? { ...p, skill: answer, updatedAt: now } : p;
    case 'format':
      return inCatalog(FORMAT_OPTIONS, answer) ? { ...p, format: answer, updatedAt: now } : p;
    case 'name': {
      const trimmed = answer.trim();
      return { ...p, displayName: trimmed.length > 0 ? trimmed : null, updatedAt: now };
    }
    case 'promise':
      return p; // the promise screen has no answer — it advances, nothing more
  }
}

/** Router leads with what the user came for: improvers see Study first, hosts see Play first. */
export function orderActionsForGoal<T extends { key: string }>(
  actions: T[],
  goal: PersonaGoal | null,
): T[] {
  if (!goal) return actions;
  const leadKey = goal === 'host' ? 'play' : 'study';
  const lead = actions.filter(a => a.key === leadKey);
  const rest = actions.filter(a => a.key !== leadKey);
  return [...lead, ...rest];
}
