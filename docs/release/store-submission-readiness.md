# Store submission readiness — T Poker

_Last updated: 2026-07-23. Companion to `docs/store-release.md` (the how-to) and
`docs/release/store-data-safety.md` (the forms)._

## The standing principle (applies to everything store-facing)

We submit under the owner's **existing individual Apple Developer account**. Apple
requires an **organization** account for apps classified as gambling / real-money
gaming, and simulated-gambling apps draw heightened scrutiny. T Poker is neither — it is
(a) a poker **strategy-education** app and (b) a **scorekeeping utility** (buy-in ledger
+ settlement calculator) for private home games. Money is only ever *recorded* between
friends who settle in person; the app never moves, holds, wagers, or pays out anything.

**Therefore, everywhere store-facing: lead with education, describe the manager as a
ledger, and never let anything read as a poker game.** Concretely — screenshots lead
with learning; the title/subtitle/description lead with lessons and drills; the primary
category is Education; and reviewer notes state the non-gambling position explicitly.
When in doubt, choose the framing that a reviewer skimming for 20 seconds cannot
misread.

---

## ✅ Done (in the repo)

| Item | Where |
|---|---|
| Education-first screenshot set (10 shots × 3 store sizes) | `apps/poker-mobile/store-assets/screenshots/` |
| Screenshot harness repaired + 7/10 shots now fully automated (seeded guest state) | `store-assets/store-shots.mjs` |
| Gambling-reading copy softened in the app (wizard, deal-in beat, settlement screen, first-run headline, goal options) | app source, PR "education-first store posture" |
| Settlement screen states on-screen that the app never moves money | `LocalSessionSummaryScreen` |
| Privacy policy, terms, pricing, refund pages all say nothing is purchasable | `apps/poker-mobile/public/*.html` |
| Data-safety declarations (Play + Apple) incl. the "tracking = NO" reasoning | `docs/release/store-data-safety.md` |
| Consent-gated analytics (nothing sends without the Welcome choice) | `utils/analytics.ts` |
| Sign in with Apple implemented (Guideline 4.8) | `hooks/useAppleAuth.ts` |
| Billing fail-closed in production | `BillingVerifierSelection` |
| Bundle IDs, EAS profiles, PostHog key wired | `app.json`, `eas.json` |
| Landing site reworked education-first — felt/chip hero gone, study screenshots, no prices, positioning section, regenerated og card | `apps/landing`, PR "landing education-first pass" |
| Landing posture pinned by tests (no chip, no felt, no price, gambling FAQ first + open) | `apps/landing/__tests__/positioning.test.ts` |

## ✅ Decisions locked (2026-07-23)

- **`eas login` — DONE** on the owner's machine. Builds are unblocked.
- **Publisher identity = LEGAL NAME "Tay Shofer"** (individual account; not a trade
  name). The seller / developer name on both stores is Tay Shofer; the policy pages,
  the marketing-site copyright, and the in-app © now all name Tay Shofer (trading as
  True Story Labs). "True Story Labs" survives ONLY as the in-app studio byline
  (splash / Welcome / Login) and as the brand on the contact address — never as the
  store seller or the legal entity. Reconciled across every surface in the
  "publisher identity" PR; guarded by `legalSurfaces.test.ts`.
- **iPad = SUPPORTED in v1.** `app.json` keeps `"supportsTablet": true`. A study-led
  iPad screenshot set is regenerated in education-first order in slice 1.6 (the old
  committed iPad shots were pre-education-first game captures — replaced, not submitted).
  **Submission dependency:** App Store Connect *requires* a 13" iPad screenshot set once a
  build declares tablet support, so the 1.6 iPad captures must be uploaded — they are not
  optional polish.

## 🔲 Yours to do (the submission track)

Roughly in order. Nothing here is blocked by the feature waves.

1. **Native Google OAuth** — create the iOS + Android OAuth clients for
   `com.tpoker.app` (Android needs the release SHA-1 from `eas credentials`), set
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `..._ANDROID_CLIENT_ID` in EAS, append both IDs
   to the backend `GoogleSettings:ClientIds`, and add the iOS reversed-client-ID URL
   scheme to `app.json` (`docs/google-oauth-fix.md` §4 — snippet ready, not applied).
   **A click-by-click walkthrough was provided 2026-07-23 — follow that.**
2. **Apple Sign-In device test** — the code ships, but Expo Go can't prove it. Build
   `--profile preview`, install on a real iPhone, and verify the button appears and
   completes sign-in. (Guideline 4.8 requires it wherever Google sign-in is offered.)
3. **Listing copy** — paste the education-led title / subtitle / short + long
   description / keywords from `docs/store-release.md` (§ Suggested copy). Do not
   improvise on submission day.
4. **Categories** — iOS primary **Education**, secondary **Reference**. Play: type
   **App (not Game)**, category **Education**. Never Games ▸ Card or Games ▸ Casino.
5. **Age rating (Apple questionnaire COMPLETED 2026-07-23)** — Gambling **No**, Simulated
   Gambling **None**, Loot Boxes **No**, Contests **Infrequent/Mild** (friendly leaderboards +
   head-to-head, no prizes or sweepstakes); calculated 13+ **overridden to 18+**. Use the same
   answers on Play/IARC; select the **18+** target-audience band. 18+ is our stated audience,
   not a claimed content rating. Full detail: `docs/store-release.md` Step 6.
6. **Reviewer notes** — paste the verbatim note from `docs/store-release.md`, including
   the guest-mode walkthrough so the reviewer never needs an account.
7. **Data-safety forms** — file per `docs/release/store-data-safety.md`. If the
   submitted build has no `EXPO_PUBLIC_POSTHOG_KEY`, declare "no data collected" and
   re-file with the first analytics build.
8. **Build + submit** — `eas build --profile production`, then TestFlight → App Store
   review; Play's first `.aab` must be uploaded manually in the console.

## ⚠️ Known gaps worth a decision before submitting

- **Feature graphic + app icon** are the most casino-coded assets we have (gold chip +
  fanned cards). The icon is brand equity — leave for v1 — but the Play feature graphic
  should get an education-led tagline and de-emphasised chip art.
- ~~Remaining in-app softenings~~ — **DONE (slice 1.6).** "Money on the Table" →
  "Total Buy-ins", "PRIZE POOL / TOTAL POT" → "TOTAL BUY-INS", the "$X pot" session
  meta on guest-home / sessions / stats → "$X total", the ShareCard footer gained a
  "settled in cash, in person" line, "Your Week at the Club" → "Your Poker Week", and
  "play responsibly" left the Login / Welcome / Profile legal blocks. Pinned by
  `classification.test.ts`. The softened shots (06 / 08 / 09 / 10) were re-captured across
  all phone profiles **plus a new study-led iPad-13 set (2048×2732)** — the 9 harness-automated
  shots per profile (07-final-count stays a manual, iPhone-only capture, unchanged). The landing
  site's settle-up shot was refreshed from the new 08.
