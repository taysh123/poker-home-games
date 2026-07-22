/**
 * Quiet Luxury funnel engine (Wave 1, slice 1.1) — PURE. Step order, answer application,
 * option catalogs (copy lives here, not in the screen), and goal-driven router ordering.
 * The caller passes `now` — no Date.now inside logic.
 */
import { emptyPersona } from '../../types';
import {
  FUNNEL_STEPS,
  nextStep,
  prevStep,
  applyAnswer,
  GOAL_OPTIONS,
  SKILL_OPTIONS,
  FORMAT_OPTIONS,
  orderActionsForGoal,
} from '../funnel';

const T0 = '2026-07-22T10:00:00.000Z';
const T1 = '2026-07-22T10:01:00.000Z';

describe('funnel steps', () => {
  it('runs promise → goal → skill → format → name → router', () => {
    expect(FUNNEL_STEPS).toEqual(['promise', 'goal', 'skill', 'format', 'name']);
    expect(nextStep('promise')).toBe('goal');
    expect(nextStep('goal')).toBe('skill');
    expect(nextStep('skill')).toBe('format');
    expect(nextStep('format')).toBe('name');
    expect(nextStep('name')).toBe('router');
  });

  it('prevStep walks back; the promise step has no back', () => {
    expect(prevStep('goal')).toBe('promise');
    expect(prevStep('skill')).toBe('goal');
    expect(prevStep('format')).toBe('skill');
    expect(prevStep('name')).toBe('format');
    expect(prevStep('promise')).toBeNull();
  });
});

describe('option catalogs', () => {
  it.each([
    ['goal', GOAL_OPTIONS, ['host', 'improve', 'both']],
    ['skill', SKILL_OPTIONS, ['new', 'solid', 'grinder']],
    ['format', FORMAT_OPTIONS, ['cash', 'tournament', 'both']],
  ] as const)('%s options carry unique ids and human copy', (_step, options, ids) => {
    expect(options.map(o => o.id)).toEqual(ids);
    for (const o of options) {
      expect(o.label.length).toBeGreaterThan(0);
      expect(new Set(options.map(x => x.id)).size).toBe(options.length);
    }
  });
});

describe('applyAnswer', () => {
  it('records goal / skill / format from catalog ids and stamps updatedAt', () => {
    let p = emptyPersona(T0);
    p = applyAnswer(p, 'goal', 'improve', T1);
    p = applyAnswer(p, 'skill', 'solid', T1);
    p = applyAnswer(p, 'format', 'tournament', T1);
    expect(p.goal).toBe('improve');
    expect(p.skill).toBe('solid');
    expect(p.format).toBe('tournament');
    expect(p.updatedAt).toBe(T1);
    expect(p.completedAt).toBeNull(); // completion is a separate, explicit act
  });

  it('ignores answers that are not in the step catalog (defensive)', () => {
    const p = applyAnswer(emptyPersona(T0), 'goal', 'yolo', T1);
    expect(p.goal).toBeNull();
  });

  it('name: trims; empty or whitespace ⇒ null (skipped name)', () => {
    expect(applyAnswer(emptyPersona(T0), 'name', '  Tay  ', T1).displayName).toBe('Tay');
    expect(applyAnswer(emptyPersona(T0), 'name', '   ', T1).displayName).toBeNull();
  });

  it('promise has no answer — persona is unchanged', () => {
    const p = emptyPersona(T0);
    expect(applyAnswer(p, 'promise', 'anything', T1)).toEqual(p);
  });

  it('is non-mutating', () => {
    const p = emptyPersona(T0);
    applyAnswer(p, 'goal', 'host', T1);
    expect(p.goal).toBeNull();
  });
});

describe('orderActionsForGoal — the router leads with what the user came for', () => {
  const actions = [{ key: 'play' }, { key: 'track' }, { key: 'study' }, { key: 'improve' }];

  it('host ⇒ play first (original order otherwise)', () => {
    expect(orderActionsForGoal(actions, 'host').map(a => a.key)).toEqual(['play', 'track', 'study', 'improve']);
  });

  it('improve/both ⇒ study first, rest in original order', () => {
    expect(orderActionsForGoal(actions, 'improve').map(a => a.key)).toEqual(['study', 'play', 'track', 'improve']);
    expect(orderActionsForGoal(actions, 'both').map(a => a.key)).toEqual(['study', 'play', 'track', 'improve']);
  });

  it('no goal ⇒ untouched (skippers see the default)', () => {
    expect(orderActionsForGoal(actions, null)).toEqual(actions);
  });

  it('does not mutate the input', () => {
    const copy = actions.map(a => ({ ...a }));
    orderActionsForGoal(actions, 'improve');
    expect(actions).toEqual(copy);
  });
});
