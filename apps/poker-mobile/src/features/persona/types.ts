/**
 * Persona (Wave 1) — the user's onboarding-quiz answers, powering personalized surfaces.
 * Local-first: lives in tpoker.persona.v1 (account-scoped map — see data/personaStore.ts);
 * a server column arrives in Wave 3.2. `displayName` is display-only and MUST NEVER be sent
 * to analytics (privacy rule pinned in the OnboardingV2 screen test).
 */

export type PersonaGoal = 'host' | 'improve' | 'both';
export type PersonaSkill = 'new' | 'solid' | 'grinder';
export type PersonaFormat = 'cash' | 'tournament' | 'both';

/** A completed placement drill (slice 1.4) — one-time; its presence hides every drill entry. */
export interface PersonaPlacement {
  score: number;
  total: number;
  at: string;
}

export interface Persona {
  schemaVersion: 1;
  goal: PersonaGoal | null;
  /** Self-reported in the funnel; REPLACED by the measured level once a placement is recorded. */
  skill: PersonaSkill | null;
  format: PersonaFormat | null;
  /** null = never took the placement drill (also true for personas stored before 1.4). */
  placement: PersonaPlacement | null;
  /** Optional friendly name (step 5). Display-only — never analytics, never sent to the server today. */
  displayName: string | null;
  /** Set once by completeFunnel(); null = never finished the quiz (skipped or pre-Wave-1 user). */
  completedAt: string | null;
  updatedAt: string;
}

export function emptyPersona(now: string): Persona {
  return {
    schemaVersion: 1,
    goal: null,
    skill: null,
    format: null,
    placement: null,
    displayName: null,
    completedAt: null,
    updatedAt: now,
  };
}
