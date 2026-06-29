# T Poker V2 — Beta Testing & Release Plan (STEP 5)

**Branch:** `feature/v2-poker-platform` · **Date:** 2026-06-20 · No PR/merge. Source: `docs/v2-final-architecture-review.md`, `docs/v2-production-integration-plan.md`, `docs/safe-launch-readiness.md`, + this phase's audits.

## Beta posture
Beta validates the V2 experience (Play/Track/Study/Improve + retention + currency) with **no live billing and no AI vendor**. So in beta: paywall/billing OFF; AI Coach either OFF or shown with the **mock provider clearly labeled "demo"** (it returns canned, non-real coaching). All other V2 flags ON.

### Beta build profile (config, low-risk)
Add a `beta` EAS/build profile that flips the dev-on V2 flags ON in a release build: `nav5, onboardingV2, bankroll, study, coach(see below), retention, reminders, currencyPrefs, polish, v2Splash`. **OFF in beta:** `paywall`, `coachScreenshot`. Today these are gated by `__DEV__` (`config/features.ts`) — beta needs an explicit env/profile switch so a *release* build can enable them. (Production prod-flags stay OFF until launch.)

Decision needed: **Coach in beta** — (a) OFF (cleanest), or (b) ON with mock + a "Demo analysis — not live AI yet" banner to test the UX. Recommend (b) behind a label.

## Channels & prerequisites
| Channel | Prereqs |
|---|---|
| **iOS — TestFlight** | Apple Developer acct; bundle id `com.tpoker.app`; EAS iOS build (`npx eas build -p ios`); `EXPO_PUBLIC_API_URL` + Google iOS client id; Sign in with Apple working; push needs the EAS build (not Expo Go). |
| **Android — Play Internal Testing** | Play Console; EAS Android build; Android OAuth client id; internal testers list. |
| **Web — Vercel preview** | already deploys `main`; point a preview at the beta build; no push/native picker on web. |
| **Backend** | Railway up with B1 auth; prod secrets set (JWT, DB, Google/Apple client ids); migrations B2/B5 **not** required for beta (no billing) but DB schema must match the code in use. |

## QA checklist (run on iOS + Android + web)
**Onboarding/auth:** first-run pillar carousel → starting-point → real action; Google + Apple sign-in; guest→account; logout lands on guest Home; pending-invite resume.
**Navigation (nav5):** ≤5 tabs (Home/Track/Study/Coach/Groups); Track hub segments (Bankroll/Sessions/Stats); back behavior; deep links `join/*`.
**Play:** local cash + tournament (blind clock, payouts), settle, summary, share; server session lifecycle for authed.
**Track:** bankroll log (native date picker), ROI/ABI/ITM, chart; sessions list; stats periods.
**Study:** Spot Trainer (10-spot quiz), Decision Trainer (continuous + finish→summary), streak + freeze, daily-goal stepper.
**Improve (if on):** analyze → result (mock/demo labeled); error mapping (no_credits/rate_limited/requires_account/unavailable) shows correct copy.
**Retention:** XP/rank badge, Achievements screen (server+local), cross-pillar CTAs, reminders + Notification Preferences (permission prompt, scheduling).
**Currency:** picker switches symbol app-wide; numbers identical (no conversion); persists; locale default on fresh install.
**Cross-cutting:** offline banner; error/retry; reduced-motion; a11y labels (VoiceOver/TalkBack); 375px + landscape; crash-free; cold-start splash (tap-to-skip).

## Success criteria (beta)
- **Stability:** crash-free sessions ≥ 99%.
- **Activation:** ≥ 60% of new installs complete `first_action_completed`; ≥ 30% create an account.
- **Engagement:** ≥ 20% return D1; a measurable study-streak cohort (≥2-day).
- **Funnel integrity:** Tier-1 analytics events flow end-to-end to the provider.
- **Qualitative:** no P0/P1 bugs open; testers can complete every pillar's core task unaided.

## Release Candidate (RC) checklist — before public launch
- [ ] Apply migrations `B2_MonetizationEnforcement` + `B5_FraudAndObservability` to prod DB (backup first).
- [ ] Live billing: real Apple/Google verification wired + sandbox-verified; `BillingSettings.Provider=direct`, `AcceptSandbox=false`; ASSN V2 + Play RTDN webhooks configured.
- [ ] Real AI provider (`ICoachAiProvider`) server-side; remove mock/demo; confirm refund-on-failure; `AiCost` populated.
- [ ] Auth-abuse enforcement (turn the `AuthAbuseGuard` no-op into real throttling/lockout).
- [ ] Analytics vendor wired in `dispatch()` + identify/reset; privacy policy updated; opt-out toggle.
- [ ] Flip prod flags ON per staged plan (coach → paywall last); `EnforceBlocking` after fraud tuning.
- [ ] Security: HTTPS redirect/HSTS + security headers; web CSP; `/health` DB check; conn-pool tuning + decrement load test.
- [ ] Accessibility: contrast sweep (`textDim`-as-text) + dynamic-type pass.
- [ ] Content: at least one verified (non-illustrative) dataset OR keep the labeled starter; remove any "demo" coach labeling once real.
- [ ] Store: listings/screenshots (have `store-assets/`), privacy URL live, review passed for both stores.

## Launch blockers — classified
### Must fix before BETA
- Beta build profile flipping V2 flags on in a release build (config).
- Tier-1 analytics events instrumented (+ vendor wired *or* an explicit decision to run buffered-only for closed beta).
- Coach beta decision (off, or mock labeled "demo").
- EAS iOS/Android builds green; Google/Apple sign-in working in builds; backend reachable; crash-free baseline.
- Bundled content acceptable (labeled starter is fine for beta).

### Must fix before LAUNCH
- Migrations applied; live billing + real verifier; real AI vendor; auth-abuse enforcement; analytics provider + privacy/opt-out; security headers/HTTPS/CSP/health-DB-check; load test; contrast + dynamic-type; store review; flip prod flags.

### Can defer to V2.1 / V3
- Server dataset catalog + entitlement-gated premium packs; Quiz engine; Coach knowledge-injection layer; Range Viewer; per-session currency + multi-currency bankroll; XP/achievements server-authoritative + cross-device; cloud sync for local features; bankroll chart tap-to-inspect; splash shorten-after-first-run; deep-link-to-entity from notifications; RevenueCat (optional).

## Recommended next low-risk increments (await approval)
1. **Tier-1 analytics events** (additive over no-op transport — zero runtime risk; ~6–8 files).
2. **Beta build profile** (config only — flags on in a release/beta profile).
3. **`studyContent` JSON loader** (client-only, bundled-with-starter-fallback; ~3 files).
All flag-gated, prod-safe, reversible. None implemented yet — pausing per the STEP 5 instruction.
