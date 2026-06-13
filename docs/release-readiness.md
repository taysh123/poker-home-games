# T Poker — Google Play Release Readiness

_Last updated: June 13, 2026 · Publisher: **True Story Labs** · Version: 1.1.0_

This is the canonical, living readiness report for the Google Play launch of
T Poker. It is updated as blockers are cleared.

## Current launch-readiness score: **92 / 100**

All code- and content-side work is complete. The remaining 8 points are gated
entirely on **external actions only you can perform** (store account, a few
console settings, and a real-device QA pass) — there are no open in-repo blockers.

Score trajectory: 72 (initial audit) → 88 (APK networking + privacy fixes) →
clearing the privacy-domain misdiagnosis → **92** (branding, responsible-play,
18+ positioning, contact-email migration). Reaches **publish-ready** once the
external steps below are done and the corrected APK passes device QA.

---

## 1. What changed (this round)

- **Publisher identity → True Story Labs.** Subtle, premium brand attribution
  added to the Login footer ("BY TRUE STORY LABS"), a new Profile → **About &
  Support** card, the privacy policy (operator mention + "© 2026 True Story Labs"
  footer), the README ("Built by True Story Labs"), and the store-release guide
  (developer/publisher name + support email).
- **Contact email migrated** from `tayshofer05@gmail.com` →
  `truestorylabs@gmail.com` everywhere it appears (privacy policy text + `mailto:`
  + deletion-request link, and the new in-app/README/store-doc mentions). Zero
  references to the old address remain.
- **Responsible-play & age language added** (calm, factual, non-alarmist): a new
  "Responsible play & age" section in the privacy policy, a one-line note in the
  Login footer and the Profile About card, and a "Positioning & responsible play"
  paragraph in the store-release guide. States clearly: private home-game
  scorekeeping tool for **adults (18+)**, not directed at children, not a gambling
  product, play responsibly within the law.
- **In-app surfaces:** Login footer line (reachable by guests) + Profile "About &
  Support" card with tappable support email, privacy-policy link, app version, and
  the responsible-play note. Onboarding and Guest Home left visually untouched.

## 2. What is now compliant

- ✅ **Privacy policy URL** — live and correct at
  `https://poker-home-games-three.vercel.app/privacy.html` (auto-deploys `main`),
  with a working `#delete` anchor for the Data Safety deletion-request URL.
- ✅ **Account deletion** — in-app (Profile → Delete Account) **and** an email
  request channel (`truestorylabs@gmail.com`, 30-day SLA) for uninstalled users.
- ✅ **Non-gambling positioning** — reinforced in policy, store copy guidance,
  reviewer note, and in-app copy. Category guidance stays Lifestyle/Tools, **not
  Casino**.
- ✅ **Adults-only (18+) audience** — stated in policy and store age-rating guidance.
- ✅ **Brand & contact consistency** — True Story Labs + `truestorylabs@gmail.com`
  consistent across app, policy, README, and store docs.
- ✅ **APK networking** — production API URL baked into EAS builds (commit
  `aaf473f`); builds from `99e9d17e` onward hit the real backend.
- ✅ **Engineering gates** — TypeScript clean, 50/50 unit tests, web export clean,
  browser regression with zero console errors.

## 3. Remaining blockers

- **None in-repo.** No open code or content blockers.
- The only hard gate left is a **real-device QA pass** of the corrected APK
  (verifying sign-in works against the live backend) — this requires your phone.

## 4. Remaining external actions (only you can do these)

1. **Create the Google Play Console account** ($25 one-time); set developer name
   = **True Story Labs**, support email = `truestorylabs@gmail.com`.
2. **Device QA** of the corrected APK (build `99e9d17e` or newer): install, sign
   in (email + Google), run one guest game and one tournament end-to-end.
3. **Google OAuth (Google Cloud Console):** add
   `https://poker-home-games-three.vercel.app` as an Authorized JavaScript origin
   + redirect URI on the Web client (the old `t-poker` origin is wrong/unowned).
4. **Railway env sanity check:** confirm `AppSettings__WebBaseUrl` and
   `AllowedOrigins__0` = `https://poker-home-games-three.vercel.app`.
5. **Production build & first upload:** `eas build --profile production --platform
   android` → upload the `.aab` to Internal testing (first upload is manual).
6. **Optional:** FCM push key via `eas credentials` (app degrades gracefully
   without it); crash reporting (e.g. Sentry) before wider scale.

## 5. Recommended next milestone

**Internal testing track on Google Play.** Concretely: create the Play account →
device-QA the corrected APK → build the production `.aab` → upload to Internal
testing with yourself as tester. That single milestone exercises the real store
pipeline end-to-end and surfaces any console-side surprises before you promote to
Production. Do the OAuth-origin and Railway-env checks alongside it so web and
Google sign-in are verified at the same time.

---

_See also: [store-release.md](store-release.md) (full step-by-step guide),
[google-oauth-fix.md](google-oauth-fix.md) (OAuth external steps),
[../PRIVACY.md](../PRIVACY.md) (policy source of truth)._
