# Q1.4 — Ratings & feedback

## 0. SUPERSEDED (owner, 2026-07-29) — the sentiment sheet is gone

> **What changed:** master-plan decision **4a** — a pre-prompt asking "Enjoying T Poker?", routing
> happy users to the native store review and unhappy users to a prefilled support email — is
> **superseded**. We now call `requestNativeReview()` **directly** at a qualifying moment. There is
> no sheet of our own, no sentiment capture, and no in-app feedback branch.
>
> **The owner's reasoning, recorded because it reversed an earlier approval of their own:**
>
> 1. **The qualifying moments already ARE the sentiment filter.** Someone who finished a drill at
>    ≥70%, completed a game, and holds a 7-day study streak is not an unhappy user. Behavioural
>    selection is more reliable than asking. The sheet was buying very little.
> 2. **What it cost was large.** An entire occlusion-geometry subsystem, which the Q1.4 critic
>    fleet showed produced two blockers — the sheet could rise over a **live, in-progress game**
>    (the phone being passed around a table mid-hand), and it could **never** fire on a real
>    finished game because the "fully seen" predicate was unsatisfiable for a settlements list of
>    more than ~4 transfers. The mechanism was inverted against its own intent.
> 3. **App Store Guideline 1.1.7.** Routing only the happy cohort to the native dialog is the
>    canonical *review-gating* pattern Apple names as a rejection cause. On an individual developer
>    account that already took a 2.3.6 metadata rejection, against a standing invariant that the
>    store track is never blocked, that trade "isn't close".
> 4. **Nothing meaningful is lost:** the unhappy-user feedback path already exists in Profile.
>
> **What survived and still ships:** the pure eligibility rules, the store, the native wrapper,
> `EngagementContext.isCelebrating`, and the `SUPPORT_EMAIL` centralisation.
>
> **Sections below are kept for provenance.** Where they describe the sheet, the protected-region
> geometry, sentiment capture, or the feedback branch, they describe a design that **was not
> shipped**. Superseded passages are marked inline. The authoritative description of what ships is
> `CLAUDE.md` → "Review prompts" plus the header comment in
> `apps/poker-mobile/src/features/reviews/logic/reviewPromptLogic.ts`.

---

## 1-original. Ratings & feedback: the sentiment gate *(as designed, before §0)*

- **Date:** 2026-07-28 · **Status:** APPROVED (owner, 2026-07-28)
- **Slice:** Q1.4 of the product-quality master plan
  (`2026-07-27-product-quality-master-plan.md` §3, area G). Master-plan decision **4a** already
  settled the shape: sentiment pre-gate → happy goes to the native store review, unhappy goes to a
  prefilled support email. No server work, no in-app feedback form (deferred to its own slice).
- **Provenance:** two parallel code-exploration passes (2026-07-27/28) mapping the qualifying-moment
  surfaces and the flag/analytics/storage conventions. Every structural claim below was verified
  against the code, not assumed. The three findings that changed the design are called out in §2.

## 1. What we are building

An in-app prompt that asks whether the user is enjoying T Poker, fired only after a genuinely
positive moment, and routes the two answers to two different places. It never asks mid-task, never
asks over a celebration, never asks often, and never depends on the native dialog actually
appearing.

**Ship invariants this slice inherits and does not touch:** nothing purchasable; AI Coach makes zero
API calls; all premium stays "Coming soon"; guests keep the full free experience; honesty pins are
extended, never weakened; the store track is never blocked. This slice adds no purchase surface and
no premium claim, so it interacts with those invariants only by staying clear of them.

## 2. Three findings that changed the naive design

Written down because each one would otherwise be rediscovered as a bug.

1. **`SessionScreen`'s game summary is itself a `<Modal>`** (`screens/SessionScreen.tsx:1941`,
   `endStep === 3`). Our `BottomSheet` primitive is also a `Modal`. Nested modals are a known iOS
   failure mode — the inner sheet renders behind the outer one or not at all. **Therefore the server
   path records its qualifying moment when the summary is *dismissed*, never while it is open**, and
   presents afterwards over the finished session screen.

   An earlier draft made the server path record-only, on the reasoning that master plan Risk #4 says
   to stay off the 3.1k-line monolith. That was wrong, and worth recording as a near-miss: a user who
   runs cloud sessions and never studies would have accumulated qualifying moments and never once
   been asked — silently excluding the home-game user who is arguably our core audience. Risk #4
   warns against cosmetic churn and premature extraction, not against additive instrumentation. The
   monolith gets `onLayout` reporting on its settlements section plus a moment call: additive, no
   logic change, no restructuring.
2. **`currentStreak` is two unrelated things.** `HomeScreen` shows a *server win/loss* streak that
   can be **negative** ("❄️ 3-game loss streak"); `StudyScreen` shows the *study-day* streak. Gating
   on the wrong one would ask for a five-star rating in the middle of a losing run. **Only the
   study-day streak is a qualifying signal**, and §6 pins it so it cannot be rewired silently.
3. **No install date or app-open counter exists anywhere in the app.** The master plan's
   "install-age floor" had nothing to read. We add `installedAt` (§4).

Two further findings are recorded as **debt, deliberately not fixed here** (owner decision
2026-07-28: fix what Q1.4 needs, flag the rest):

- **Achievement unlock has two independent implementations** with separate queues — the local one in
  `features/engagement/state/EngagementContext.tsx:184` and a server one in
  `screens/StatsScreen.tsx:455`. Q1.4 wires **only the local queue**. An achievement dismissed on
  StatsScreen therefore does not count as a qualifying moment. This is a small coverage gap, not a
  correctness bug.
- **The celebration-collision constants are ad-hoc and one is mismatched.**
  `EngagementContext.tsx:152-155` hardcodes `5500`/`2000`ms, and the `2000` compensates for a
  `Celebration` the quiz runner does not actually render. Master plan Q3.5 already schedules
  replacing these with a real queue. Q1.4 does not touch them.

## 3. Architecture

Five new units. Everything that can be pure, is pure — the eligibility and presentation rules are
the part that is hard to test by hand and easy to get wrong, which is exactly the part that must not
live in a screen.

| Unit | Path | Responsibility |
|---|---|---|
| Pure rules | `features/reviews/logic/reviewPromptLogic.ts` | Eligibility + presentation gating. Zero imports. `nowMs` injected. |
| Store | `features/reviews/data/reviewPromptStore.ts` | `tpoker.reviewPrompt.v1`. Fail-safe: corrupt payload loads as defaults, writes never throw. |
| Native wrapper | `features/reviews/nativeReview.ts` | Lazily `require`s `expo-store-review` behind a `Platform.OS` check; every call try/caught. |
| Host + state | `features/reviews/state/ReviewPromptContext.tsx` | Holds state, exposes `recordMoment(kind)` and the presentation controls, renders the sheet. |
| Sheet UI | `features/reviews/ui/SentimentSheet.tsx` | Direction-A content rendered **inside the existing `components/BottomSheet`**. |

Plus one shared constant: `config/support.ts` (§8).

The pure module follows `utils/reminderLogic.ts` exactly — the closest existing analogue: a header
comment stating the invariant, exported types, exported constants, one or two exported decision
functions, private helpers at the bottom, no imports at all.

### Why a context and not per-screen state

Three different screens produce qualifying moments and two can present the sheet. Per-screen state
would duplicate the rate-limiting in three places, which is how a "once per 90 days" rule quietly
becomes "three times per 90 days". One host owns the counters and the decision; screens only report
what happened and where the protected content is.

## 4. Data

```ts
// tpoker.reviewPrompt.v1
type ReviewPromptState = {
  installedAt: number;              // epoch ms, stamped once on first load
  moments: number;                  // qualifying moments seen (monotonic)
  streakMilestoneHigh: number;      // highest study-streak milestone already counted
  lastPromptedAt: number | null;    // epoch ms of the last time the sheet was SHOWN
  promptedVersions: string[];       // app versions in which the sheet was shown
  lastSentiment: 'happy' | 'unhappy' | null;
};
```

`installedAt` is stamped as `now` the first time the store loads with no existing record. For a user
upgrading from 1.1.1 this reads as "0 days old", which is accepted and honest: we do not know when
they installed, so we do not pretend to. The real engagement gate is the ≥3 qualifying moments
requirement, which is a far better signal than install age; the floor is a short backstop, not the
primary rule.

`streakMilestoneHigh` exists because a streak is a *state*, not an event. Without a high-water mark,
"streak ≥ 7" would qualify on every render for the rest of the streak.

## 5. The rules

### Eligibility — `evaluateReviewPrompt(state, signals) → { eligible: boolean; reason: Reason }`

All of the following must hold:

| Rule | Constant | Value |
|---|---|---|
| Install age | `INSTALL_AGE_FLOOR_MS` | 3 days |
| Qualifying moments | `MIN_QUALIFYING_MOMENTS` | 3 |
| Cooldown since last shown | `PROMPT_COOLDOWN_MS` | 90 days |
| Not already shown in this app version | — | `!promptedVersions.includes(version)` |

The returned `reason` is a discriminated string (`'ok' | 'too_new' | 'too_few_moments' |
'cooldown' | 'already_this_version'`) so tests assert *why* a decision was made, not just that it
was false. A test that only asserts `false` passes for the wrong reason and keeps passing after the
logic breaks.

**Showing the sheet always consumes the allowance**, whichever button is pressed and even if none is:
`lastPromptedAt` is set and the current version is appended to `promptedVersions` at the moment the
sheet becomes visible. "Yes" and "Not really" additionally record `lastSentiment`.

The alternative — letting "Not now" leave the allowance unconsumed — was considered and rejected. A
user already past the ≥3-moment threshold would be re-asked at their very next qualifying moment,
which is precisely the nagging this slice exists to avoid. "Not now" means *later*, and 90 days is a
defensible reading of later.

An unhappy answer is a suppression, not a permanent ban: after the cooldown and in a later app
version, that user can be asked again.

### Presentation — `canPresentNow(input) → boolean`

Eligibility says *whether* we may ask. This says *whether right now is a decent time*. All must hold:

- `dwellElapsedMs >= requiredDwellMs`
- `!isCelebrating`
- the protected region, if any, is **both** already seen **and** not currently occluded

There are exactly **three presentation surfaces**, each a terminal state where the user's task is
already finished:

| Surface | Protected region | Dwell |
|---|---|---|
| `LocalSessionSummaryScreen` | settlements block | 7000ms — the game-end `Celebration` runs ~5.04s, so this clears the confetti and still leaves reading time |
| `SessionScreen`, after the summary modal is dismissed | settlements block | 7000ms — a money screen; same reasoning, though no celebration is playing by then |
| Trainer results (`SpotTrainerScreen`, `done === true`) | none | 3000ms — its success `Celebration` runs ~1.5s |

### Protecting the settlement list — ⛔ SUPERSEDED (§0), never shipped

> This entire mechanism was deleted. It is retained only because the critic fleet's findings
> against it are instructive: the `null`-rect case conflated "nothing to protect" with "not
> measured yet" and failed **open** on the money screen, while `fullyVisibleAboveSheet` demanded
> the whole block fit on screen simultaneously and so failed **closed** on any real settlements
> list. With no sheet of our own there is no region to protect — the OS owns its dialog.

Owner constraint, verbatim: *"the user must have clearly seen and absorbed their settlements before
anything rises over them"* and *"never cover the settlement list."*

A dwell timer alone cannot satisfy this — a user who has not scrolled has not seen the settlements no
matter how long they waited. So the summary screen reports the settlements block's viewport rect
(`onLayout` + scroll offset) and a pure helper decides:

```ts
regionState({ top, bottom, viewportH, sheetH }) → {
  fullyVisibleAboveSheet: boolean;   // block sits entirely above where the sheet will be
  intersectsSheet: boolean;          // block would be covered right now
}
```

The host keeps a **sticky** `seen` flag set the first time `fullyVisibleAboveSheet` is true, and
requires `seen && !intersectsSheet` before presenting. Screens with no protected content (drill
results) pass `null` and are gated on dwell alone.

This is a pure function over four numbers, so it is tested against real geometry — short summary that
needs no scrolling, long summary scrolled past the block, block straddling the sheet edge — without
rendering anything.

### Celebration coordination

There is no shared "a celebration is playing" signal today. Q1.4 adds the minimum it needs:
`EngagementContext` exposes a derived `isCelebrating` boolean (it already computes
`unlockQueue.length > 0` and `celebrate` internally). Additive, no behaviour change to existing
consumers. The ad-hoc `5500`/`2000` constants are left alone as noted in §2.

## 6. Honesty and safety pins

Following the house convention that a pin must pin what it claims (mutation-tested):

1. **Moment vocabulary pin.** The producible moment kinds are exactly
   `['achievement_dismissed', 'drill_strong', 'game_summary', 'streak_milestone']` — asserted as a
   sorted array, in the style of `utils/__tests__/reminderLogic.test.ts`'s honesty block. Adding a
   fifth kind requires editing the pin deliberately.
2. **No win/loss streak.** The `ReviewSignals` type carries **no** win/loss field, so the wrong
   streak is not merely discouraged, it is unrepresentable. A test asserts the signal keys.
3. **Native dialog is never promised.** No copy anywhere states that a rating dialog will appear.
   `requestReview()` returning false or throwing is a normal, silent outcome — this is the
   `isAvailableAsync` reality on iOS (~3 prompts/year, may no-op) and the rule that no reminder or
   prompt may promise an unavailable capability.
4. **Neither answer dead-ends.** Both branches are asserted to produce an action.
5. **Flag matrix.** `reviews` is added to `PROD_FLAGS` **ON**, and to `expectedOn` in
   `config/__tests__/features.test.ts` with a justification comment, in the same PR — per the
   standing rule that any flip extends the matrix in its own PR.

## 7. Copy (Direction A — symmetric and quiet) — ⛔ SUPERSEDED (§0), never shipped

> No sheet ships, so none of this copy exists in the app. The reasoning about symmetry is kept
> because it remains the right instinct for any future in-app prompt: styling the agreeable answer
> more prominently manufactures the result you are claiming to measure.

Owner-selected taste direction. One line, two **equally weighted** buttons, no gold on either, no
icon, no illustration.

```
        ───  (handle)

   Enjoying T Poker?

  ┌────────────┐  ┌────────────┐
  │ Not really │  │    Yes     │
  └────────────┘  └────────────┘
       (identical weight)

         Not now
```

The symmetry is a correctness requirement, not an aesthetic preference. Styling "Yes" as a gold
gradient CTA and "Not really" as a muted link manufactures the happy answer to farm five-star
ratings. That is the dark-pattern version of this exact feature and it is incompatible with the
copy-honesty posture the rest of the app is held to.

"Not now" dismisses without recording sentiment, but still consumes the allowance (§5) — showing the
sheet at all is the thing we rate-limit, not answering it.

## 8. Support email centralisation

The address `truestorylabs@gmail.com` currently appears as four literals in TypeScript
(`ProfileScreen.tsx:604,607,610` and `PaywallScreen.tsx:305`) plus the shipped policy HTML. The app
side gets one constant, mirroring the landing's existing `apps/landing/lib/site.ts` pattern:

```ts
// config/support.ts
export const SUPPORT_EMAIL = 'truestorylabs@gmail.com';
export function supportMailto(subject: string, body?: string): string;
```

The rendered *text* in ProfileScreen still contains the literal address, so
`features/premium/__tests__/legalSurfaces.test.ts` (which reads `public/*.html` from disk and pins
ProfileScreen's visible text) stays green. The policy HTML is not templatised.

## 9. Analytics

Typed events appended to the `AnalyticsEvent` union in `utils/analytics.ts`. Props stay within the
existing discipline — ids, counters, and flags only, never amounts or names.

| Event | Props |
|---|---|
| `review_prompt_shown` | `moment_kind`, `moments` |
| `review_sentiment` | `value: 'happy' \| 'unhappy'` |
| `review_native_requested` | `available: boolean` |
| `review_feedback_opened` | — |
| `review_prompt_dismissed` | — |

Dispatch remains consent-gated exactly as today; no change to the analytics gate.

## 10. Platform behaviour

`expo-store-review` is added as a **real dependency** — `jest.mock(..., { virtual: true })` is banned
repo-wide by `utils/__tests__/jestMockHygieneBan.test.ts`, so a fake module is not an option. It
needs no config plugin, so `app.json` requires no change.

Web is a no-op by construction: the native module is lazily `require`d behind
`Platform.OS === 'ios' || 'android'`, following `utils/reminders.ts`. On web the sheet never presents,
because there is no store to send anyone to and the feedback path is reachable from Profile anyway.

## 11. Files

**New:** `features/reviews/logic/reviewPromptLogic.ts` · `features/reviews/data/reviewPromptStore.ts`
· `features/reviews/nativeReview.ts` · `features/reviews/state/ReviewPromptContext.tsx` ·
`features/reviews/ui/SentimentSheet.tsx` · `config/support.ts` · tests under
`features/reviews/**/__tests__/`.

**Modified:** `config/features.ts` (+`reviews` ON) · `config/__tests__/features.test.ts` +
`features.prodFlags.test.ts` · `utils/analytics.ts` (event union) · `App.tsx` (provider mount) ·
`features/engagement/state/EngagementContext.tsx` (+`isCelebrating`) ·
`features/study/ui/SpotTrainerScreen.tsx` (lift `acc` out of its closure, record moment) ·
`screens/LocalSessionSummaryScreen.tsx` (protected-region reporting + record moment) ·
`screens/SessionScreen.tsx` (protected-region reporting + record moment on summary dismissal —
additive only, no logic change) · `screens/ProfileScreen.tsx`
and `features/premium/ui/PaywallScreen.tsx` (use `SUPPORT_EMAIL`) · `package.json`.

## 12. Testing

RED first for all logic, per the standing per-slice rule.

- **Eligibility matrix** — every `reason` branch asserted individually, plus the boundary cases
  (exactly 3 moments, exactly at the floor, exactly at the cooldown edge).
- **Presentation gating** — dwell boundaries per surface; `isCelebrating` blocks; the seen/occluded
  matrix.
- **`regionState` geometry** — short summary needing no scroll, scrolled past, straddling the sheet
  edge, block entirely off-screen above and below.
- **Store** — fail-safe load on corrupt JSON, `installedAt` stamped exactly once, writes never throw,
  `streakMilestoneHigh` prevents re-counting the same milestone.
- **Native wrapper** — mocked `expo-store-review`; unavailable and throwing paths both produce a
  silent, non-crashing outcome.
- **Honesty pins** — §6.1 vocabulary, §6.2 signal keys, §6.3 no-promise copy, §6.4 no dead ends.
- **Flag matrix** — `features.test.ts` `expectedOn` extended; `features.prodFlags.test.ts` updated.

Gates before the PR: `npx tsc --noEmit` · `npx jest` · `npx expo export -p web` · a11y ·
reduced-motion · web-parity. Adversarial critic fleet before the PR is opened, per the standing rule.

## 13. Explicitly out of scope

- The in-app feedback form (master plan decision 4: deferred to its own slice).
- The `StatsScreen` server achievement queue (§2 debt).
- The `5500`/`2000` celebration constants and the celebration queue (master plan Q3.5).
- `SessionScreen` / `LocalSessionSummaryScreen` end-game duplication (master plan slice 2.1).
- Any change to the store listing, screenshots, or premium surfaces.
