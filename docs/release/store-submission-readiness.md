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

## 🔲 Yours to do (the submission track)

Roughly in order. Nothing here is blocked by the feature waves.

1. **`eas login`** on this machine (`npx eas-cli login` from `apps/poker-mobile`) —
   credentials didn't travel with the machine; required before any build.
2. **Publisher identity.** An individual account displays your **legal name** as the
   seller unless Apple approves a trade name with documentation. Decide whether to
   pursue "True Story Labs" as a DBA/trade name or ship under your legal name.
   `docs/store-release.md` currently assumes the trade name — reconcile before creating
   the listing.
3. **Native Google OAuth** — create the iOS + Android OAuth clients for
   `com.tpoker.app` (Android needs the release SHA-1 from `eas credentials`), set
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `..._ANDROID_CLIENT_ID` in EAS, append both IDs
   to the backend `GoogleSettings:ClientIds`, and add the iOS reversed-client-ID URL
   scheme to `app.json` (`docs/google-oauth-fix.md` §4 — snippet ready, not applied).
4. **Apple Sign-In device test** — the code ships, but Expo Go can't prove it. Build
   `--profile preview`, install on a real iPhone, and verify the button appears and
   completes sign-in. (Guideline 4.8 requires it wherever Google sign-in is offered.)
5. **Decide iPad support.** Either capture a study-led iPad screenshot set or set
   `"supportsTablet": false` in `app.json` and ship iPhone-only for v1. The committed
   iPad shots are pre-education-first game-management captures — do not submit them.
6. **Listing copy** — paste the education-led title / subtitle / short + long
   description / keywords from `docs/store-release.md` (§ Suggested copy). Do not
   improvise on submission day.
7. **Categories** — iOS primary **Education**, secondary **Reference**. Play: type
   **App (not Game)**, category **Education**. Never Games ▸ Card or Games ▸ Casino.
8. **Age rating** — answer **No** to gambling, simulated gambling, and contests on both
   questionnaires; select the **18+** target-audience band on Play; expect a low
   computed content rating (that's correct — 18+ is our stated audience, not a content
   rating).
9. **Reviewer notes** — paste the verbatim note from `docs/store-release.md`, including
   the guest-mode walkthrough so the reviewer never needs an account.
10. **Data-safety forms** — file per `docs/release/store-data-safety.md`. If the
    submitted build has no `EXPO_PUBLIC_POSTHOG_KEY`, declare "no data collected" and
    re-file with the first analytics build.
11. **Build + submit** — `eas build --profile production`, then TestFlight → App Store
    review; Play's first `.aab` must be uploaded manually in the console.

## ⚠️ Known gaps worth a decision before submitting

- **Landing site still leads with a felt table and money.** `apps/landing` opens on a
  green-felt poker table with a live "Pot ₪200", per-seat stacks, and a spinning gold
  casino chip, and its screenshot strip is all game-night/money shots. A reviewer who
  opens the marketing URL sees a poker client before the word "study". Queued as its own
  slice (see the master plan) — worth doing before submission.
- **Landing advertises $8.99/mo · $79.99/yr** for a product that isn't purchasable and
  whose own pricing page says "Coming soon". Same slice.
- **Feature graphic + app icon** are the most casino-coded assets we have (gold chip +
  fanned cards). The icon is brand equity — leave for v1 — but the Play feature graphic
  should get an education-led tagline and de-emphasised chip art.
- **Remaining softenings not yet applied** (deferred so committed screenshots stay
  accurate): "Money on the Table" stat label, "PRIZE POOL / TOTAL POT" hero captions,
  the ShareCard footer line, and "Your Week at the Club". Apply them together with a
  re-capture of shots 09 and 10.
