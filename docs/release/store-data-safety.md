# Store data-safety declarations — T Poker

> For submission day (and every re-filing). Written 2026-07-22, when consent-gated PostHog EU
> analytics shipped (Wave 0.2, PR #28) and the key landed in EAS (PR #32). Source of truth for
> what the app actually collects: `apps/poker-mobile/src/utils/analytics.ts` (four-condition
> gate, pinned by `analyticsDispatch.test.ts`) and `public/privacy.html`.
>
> ⚠️ If a build WITHOUT a `EXPO_PUBLIC_POSTHOG_KEY` is submitted, it collects NOTHING — file the
> forms as "no data collected" for that build and re-file with the first keyed build.

## What the app actually does (the facts behind every answer)

- Anonymous usage analytics via **PostHog, EU cloud** (`eu.i.posthog.com`). Only our explicit
  typed events (feature usage, screen flow, app version, platform, coarse device type).
  PostHog-side autocapture, session replay, heatmaps, and web vitals are **OFF** (owner-verified
  2026-07-22) — nothing beyond our `capture` calls flows.
- Collection starts only AFTER the user's explicit Welcome choice; the Profile → Privacy toggle
  turns it off any time (both CI-pinned).
- Guests: a random app-scoped PostHog ID, never linked to identity. Signed-in users:
  `identify(userId)` links events to the account id; `reset()` on logout.
- NEVER collected (privacy-policy pinned list): game amounts, buy-ins/settlements, player
  names, hand contents, messages, location, contacts, advertising IDs.
- Account data (identity, game records, groups) is separate, first-party, on Railway — declared
  under normal account functionality, unchanged by analytics.

## Google Play — Data safety form

| Category | Collected? | Shared? | Optional? | Purpose | Notes |
|---|---|---|---|---|---|
| App activity → App interactions | ✅ | ❌ | ✅ | Analytics | Typed feature-usage events only. "Shared" = No: PostHog is a data processor acting on our behalf (Play's definition excludes service providers). Optional = Yes: starts only after the Welcome choice; Profile toggle disables. |
| Device or other IDs | ✅ | ❌ | ✅ | Analytics | PostHog's random app-scoped ID. NOT the Advertising ID (we never read it). |
| Personal info → User IDs | ✅ | ❌ | ✅ | Analytics | Signed-in users only (account id via identify). |
| Personal info → Email, Name | ✅ | ❌ | ✅ | App functionality, Account management | Account signup only (pre-existing; unrelated to analytics). Guests: not collected. |
| Everything else (location, financial, health, messages, contacts, photos, audio…) | ❌ | — | — | — | Not collected. In-app buy-in/settlement figures are user-entered scorekeeping stored with the account (App functionality), never analytics. |

Security section: data encrypted in transit ✅ · users can request deletion ✅ (in-app
Profile → Delete Account, plus the email path in privacy.html) · independent security review ❌.

## Apple — App Privacy (App Store Connect)

**Data Not Linked to You** (guests; anonymous ID):
- Usage Data → Product Interaction — purpose: Analytics
- Identifiers → Device ID — purpose: Analytics (random app-scoped ID, not IDFA)

**Data Linked to You** (signed-in users):
- Identifiers → User ID — purpose: Analytics + App Functionality
- Contact Info → Email Address; Name (username) — purpose: App Functionality (account)
- User Content → Other User Content (game records the user enters) — purpose: App Functionality

**"Do you or your third-party partners use data for tracking?" → NO.**
Reasoning (keep for reviewer questions): ATT defines *tracking* as linking user/device data
with THIRD-PARTY data for targeted advertising or ad measurement, or sharing it with data
brokers. T Poker runs first-party product analytics through PostHog acting as our processor:
no ad networks, no cross-app/cross-company linking, no data sales, IDFA never requested.
Therefore no ATT prompt is required or shown.

## Consistency checklist before filing

1. The build being submitted has the PostHog key baked (eas.json profiles) — else file
   "no data collected".
2. privacy.html's never-collected list still matches reality (`legalSurfaces.test.ts` pins it).
3. PostHog project settings still have autocapture/replay/heatmaps OFF.
4. Reviewer note (store-release.md): app is a poker STUDY + scorekeeping tool, not gambling —
   unchanged by analytics.
