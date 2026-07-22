/**
 * Persona (Wave 1) — the user's onboarding-quiz answers, powering personalized surfaces.
 * Local-first: lives in tpoker.persona.v1 (account-scoped map — see data/personaStore.ts);
 * a server column arrives in Wave 3.2. `displayName` is display-only and MUST NEVER be sent
 * to analytics (privacy rule pinned in the OnboardingV2 screen test).
 */

export type PersonaGoal = 'host' | 'improve' | 'both';
export type PersonaSkill = 'new' | 'solid' | 'grinder';
export type PersonaFormat = 'cash' | 'tournament' | 'both';

export interface Persona {
  schemaVersion: 1;
  goal: PersonaGoal | null;
  skill: PersonaSkill | null;
  format: PersonaFormat | null;
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
    displayName: null,
    completedAt: null,
    updatedAt: now,
  };
}
