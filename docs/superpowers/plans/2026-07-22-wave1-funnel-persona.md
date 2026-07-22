# Wave 1 slice 1.1+1.2 — Quiet Luxury funnel + persona store

> Short slice plan (owner-approved format). Design of record: master plan §4 + owner picks
> "Card Deal" → "Quiet Luxury" (2026-07-22). Exploration maps: workflow wf_334ad99c-d40.
> One PR: `feat/onboarding-funnel-persona`. TDD throughout; inline execution.

**Goal:** replace OnboardingV2's pillar slides with the 5-step Quiet Luxury quiz funnel, persist
answers in an account-scoped persona store, and emit per-step typed analytics.

**Key decisions (approved reasoning, recorded):**
1. **The quiz REPLACES the pillar slides.** The vision caps the funnel at 4–6 screens; slides +
   quiz would be 9. The pillar copy folds into the promise screen's sub-lines ("Study daily. Run
   the night. Know your numbers."). `onboardingV2` remains the kill-switch (OFF → legacy 3-slide
   screen, untouched); NO new prod flag → no flag-matrix churn.
2. **Steps:** promise → goal (host/improve/both) → skill (new/solid/grinder) → format
   (cash/tournament/both — deliberate simplification of the vision's "cash/MTT, live/online";
   one tap per screen, and live/online adds no personalization value in a live-first app) →
   optional name (TextInput, skippable) → router (existing, now goal-reordered).
3. **No paging ScrollView** — state-driven single-step render with MotiView crossfade+stagger
   (recipes.ts), which sidesteps the module-scope Dimensions width bug entirely. Reduced motion ⇒
   instant swaps (recipes already honor it).
4. **Skip** (visible every step, existing pin): saves already-answered steps (each answer commits
   immediately), marks seen, resets to MainTabs — unchanged exit contract (`await markSeen()`
   THEN `navigation.reset`, per exploration gotcha #3).
5. **Privacy:** the typed name NEVER appears in analytics props — events carry ids/flags only
   (`named: true`). Screen test pins this.
6. **Persona storage:** one blob `tpoker.persona.v1` with `byAccount: Record<accountKey, Persona>`
   (coachStore's account-map precedent) + engagementStore's quarantine skeleton; context copies
   StudyContext's updater-commit (fileRef + writeQueue) with composed writes ONLY. Guest→account
   claim happens reactively in the context when accountKey flips guest→acct:* and the account has
   no persona (pure `claimGuestPersona` fn, TDD).

## Tasks (each: RED → GREEN → gates → commit)

1. **Pure funnel engine** — Create `features/persona/types.ts` (Persona, PersonaGoal/Skill/Format,
   `emptyPersona()`), `features/persona/logic/funnel.ts`: `FUNNEL_STEPS: ['promise','goal','skill','format','name']`,
   `QuizStep` union, `nextStep(step) → QuizStep | 'router'`, `applyAnswer(persona, step, answerId, now)`,
   option catalogs `GOAL_OPTIONS/SKILL_OPTIONS/FORMAT_OPTIONS: { id, label, sub }[]` (copy lives here,
   not in the screen), `orderActionsForGoal<T extends {key}>(actions, goal)` (improve/both ⇒ study
   first; host ⇒ play first). Test: `logic/__tests__/funnel.test.ts` — step order, applyAnswer per
   step incl. name trim/null, ordering fn, catalogs non-empty with unique ids.
2. **personaStore** — Create `features/persona/data/personaStore.ts`: `PersonaFile { schemaVersion: 1,
   byAccount }`, `emptyFile()`, `loadFile()` (quarantine to `tpoker.persona.quarantine.<ts>` on
   corrupt), `saveFile()`, pure `personaFor(file, key)`, `withPersona(file, key, persona)`,
   `claimGuestPersona(file, acctKey)` (guest→acct copy iff acct empty; guest copy retained).
   Test: `data/__tests__/personaStore.test.ts` (AsyncStorage mock map, corrupt-payload quarantine,
   claim semantics incl. no-overwrite).
3. **PersonaContext** — Create `features/persona/state/PersonaContext.tsx`: StudyContext-pattern
   (fileRef, writeQueue, updater `commit`), exposes `{ persona, isLoaded, answerStep(step, answerId),
   setName(name), completeFunnel(), }` — all composed single-commit ops reading `accountKeyFor(user)`
   live; reactive guest→acct claim effect. Test: `state/__tests__/PersonaContext.test.tsx`
   (compose: two chained writes both land; claim fires on account switch; guest persists).
4. **Analytics events** — Modify `utils/analytics.ts`: add `'funnel_step_answered' | 'funnel_completed'`
   to the union (comment: props are ids/flags only — never the typed name).
5. **Quiet Luxury screen** — Rewrite `screens/OnboardingV2Screen.tsx`: phase union
   `'quiz' | 'router'`; promise step (DM Serif `displaySerif` headline, pillar sub-lines, gradient
   PrimaryButton "Let's set you up", quiet Skip); steps render option Cards (Sora label + muted sub,
   selection = gold hairline + goldFaint glow via existing Card/PressableScale, light haptic,
   250ms beat → advance); thin gold progress bar (pre-filled: (stepIndex+1)/(steps+1), starts ~17%);
   name step = AppTextInput + "Continue" + "Skip this"; Back affordance from step 2 on;
   router phase unchanged except `orderActionsForGoal`; every answer → `answerStep` +
   `track('funnel_step_answered', { step, answer })`; completion → `completeFunnel()` +
   `track('funnel_completed', { goal, skill, format, named })` then router. All exits keep
   `await markSeen()` → `navigation.reset`. `useWindowDimensions` if any width math is needed
   (avoid module-scope Dimensions).
6. **Screen test** — Create `screens/__tests__/OnboardingV2Screen.test.tsx` (WelcomeScreen-test
   mock conventions): promise renders + funnel advances per answer; skip mid-quiz → markSeen +
   reset + partial persona retained; completion path fires typed events; **name never appears in
   any track() call args**; a11y roles/labels on option cards; reduced-motion render smoke.
7. **Wire provider** — Modify `App.tsx`: `PersonaProvider` inside Auth (needs useAuth), before
   Study (future consumers). Modify nothing else.
8. **Gates + critique + PR** — tsc · full jest · expo export web · adversarial+design critique
   workflow (stale-closure/chained-writes, UTC keys, honesty pins, guest zero-write, a11y,
   quality bar) · fix findings · PR.

**Explicit non-goals (later slices):** persona consumers (1.3), placement drill (1.4), harness
repair + screenshots (1.5), server persona (3.2), retake entry point (1.3, Profile row + a
guest-reachable path TBD there).
