# T Poker — App Store Release Guide (Android + iOS)

A complete, ordered, follow-along guide from today's state to published apps.
Everything code-side is DONE (v1.1.1, expo-doctor 18/18, working preview APKs,
notifications plugin, privacy policy live, in-app account deletion). What remains
is accounts, credentials, listings — things only you can do.

**Current proof point:** EAS preview builds produce real installable APKs
(expo.dev → taysh/t-poker → Builds). Production builds use the exact same
pipeline with store packaging.

---

> **⚠️ RESUBMISSION TRACK (2026-07-23).** T Poker was submitted once and **rejected** on two
> guidelines — **4.8.0 (Login Services)** and **2.3.6 (Accurate Metadata)** — so the app record
> already exists in App Store Connect (`ascAppId 6781109023`). Both causes are fixed in code:
> **Sign in with Apple** is implemented (`components/AppleAuthButton.tsx` + `hooks/useAppleAuth.ts`,
> offered on the sign-in screen alongside Google; verified on a physical iPhone alongside Google + Guest),
> and the listing/screenshots are **education-first** (1.6 in-app classification softening + G.1
> landing). To resubmit:
> 1. **Build number** auto-increments via EAS remote versioning (`eas.json` →
>    `appVersionSource: "remote"` + `autoIncrement: true`) — do NOT hand-edit it. app.json's
>    `versionCode` is IGNORED under remote versioning. Before building, confirm the counter is
>    ahead of the rejected build: `eas build:version:get --platform ios` (if it isn't, bump with
>    `eas build:version:set`).
> 2. **Marketing version** is bumped to **1.1.1** (app.json) as a clean resubmission record. (You
>    *could* reuse the rejected 1.1.0 record instead; a fresh version is the lower-risk path for a
>    metadata rejection.)
> 3. In App Store Connect: upload the new build, **REPLACE the old pre-education screenshots** with
>    the current education-first set (Step 5), **re-answer the age-rating questionnaire** (Step 6),
>    and paste the updated **reviewer notes** (Step 6) — they now address BOTH rejected guidelines
>    explicitly.

---

## Step 0 — What's in-code vs outside VS Code

| Done in-code (✅ shipped) | You must do outside VS Code |
|---|---|
| Bundle IDs `com.tpoker.app`, scheme, deep links | Create the store accounts |
| Icons/splash/notification color config | Play service-account key; Apple Team/ASC IDs |
| v1.1.1 + auto-incrementing build numbers | Push credentials (FCM v1, APNs) via `eas credentials` |
| Privacy policy at app.tpoker.app/privacy.html | Google OAuth iOS/Android clients (see google-oauth-fix.md) |
| In-app account deletion (Profile) | Store listings: text, screenshots upload, data-safety forms |
| Guest mode (reviewers need no account) | Final manual device test + submit clicks |
| Store screenshots + feature graphic (store-assets/) | Optional: designer pass on those assets |

---

## Step 1 — Accounts (one-time)

> **Publisher identity (decided 2026-07-23):** the app ships under the owner's
> **individual** Apple Developer / Play Console account, so the **seller / developer
> (publisher) name is the legal name, "Tay Shofer"** — NOT a trade name. Apple shows
> the individual account's legal name as the seller unless it approves a separate
> trade name with documentation, which we are not pursuing. Set the Play Console /
> App Store Connect developer name to **Tay Shofer** and the support / contact email
> to `truestorylabs@gmail.com`. "True Story Labs" remains only as an in-app studio
> **byline** (splash / Welcome / Login) and as the brand behind the contact address —
> it must never appear as the store seller or as the legal entity on the policy pages.

1. **Google Play Console** — [play.google.com/console/signup](https://play.google.com/console/signup) — $25 one-time. Personal account is fine to start.
2. **Apple Developer Program** — [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll) — $99/year. Required for ANY iOS distribution (even TestFlight). If you're Android-first, you can ship Play now and do iOS later.

## Step 2 — Create the apps in each console

**Play Console:** Create app → name "T Poker", default language, App (not game — see Step 6), Free. You'll land in a dashboard with a setup checklist that maps 1:1 to Steps 5–7 below.

**App Store Connect** (after Apple enrollment): My Apps → "+" → New App → platform iOS, name "T Poker", bundle ID `com.tpoker.app` (register the bundle ID at developer.apple.com → Identifiers first), SKU `tpoker-001`. Note the numeric **Apple ID of the app** (this is the `ascAppId`).

## Step 3 — Credentials & signing

- **Android signing:** ✅ already handled — EAS generated and stores the keystore (the preview builds prove it). Do nothing.
- **iOS signing:** run `eas credentials` (select iOS) once after Apple enrollment — EAS creates/manages the distribution certificate + provisioning profile for you. Easiest path: let EAS handle everything.
- **Play submit key (for `eas submit`):** Play Console → Setup → API access → create a **service account** (it walks you into Google Cloud) → grant it "Release manager" on the app → download the JSON → save as `apps/poker-mobile/play-service-account.json` (already gitignored).
- **eas.json placeholders:** fill `submit.production.ios.appleTeamId` (developer.apple.com → Membership) and `ascAppId` (from Step 2).
- **Push delivery credentials** (needed for push notifications in store builds):
  - Android: Firebase console → add project → link app `com.tpoker.app` → Project settings → Cloud Messaging → ensure FCM v1 → Service accounts → generate key → upload via `eas credentials` → Android → Google Service Account Key (FCM).
  - iOS: `eas credentials` → iOS → Push Notifications → let EAS create the APNs key.
- **Google sign-in — native OAuth wired + verified on a physical iPhone (2026-07-23):** all five parts of [google-oauth-fix.md](google-oauth-fix.md) **§4** are DONE — (1) iOS + Android OAuth clients created for `com.tpoker.app` (Android release SHA-1 registered); (2) `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` set in the EAS env (`eas.json`); (3) both IDs on the backend `GoogleSettings:ClientIds` (end-to-end sign-in succeeds on device, which proves the backend accepts them); (4) the reversed-client-ID `CFBundleURLTypes` scheme is committed to `app.json` → `ios.infoPlist`; (5) built with EAS and tested on-device. ⚠️ Expo Go can never do Google sign-in (SDK-54 limitation) — not a blocker; the store build is unaffected.

## Step 4 — Production builds

```powershell
cd apps/poker-mobile
eas build --profile production --platform android   # → .aab for Play
eas build --profile production --platform ios       # → .ipa for App Store
```
- `autoIncrement` is on — build numbers bump automatically; bump the human `version` in app.json per release.
- Preview vs production: preview = installable APK for your own devices (what you've been testing); production = store-packaged (AAB/IPA) with the same code.

## Step 5 — Store listing assets

Ready-made assets live in **`apps/poker-mobile/store-assets/`** (screenshots at
store sizes + Play feature graphic + 1024 icon export). A designer pass can
replace them later; they're submission-valid now.

| Asset | Play | App Store |
|---|---|---|
| App icon | 512×512 (from store-assets) | 1024×1024 (from store-assets) |
| Screenshots | phone 1080×1920 — 2–8 of them | 6.7" 1290×2796 (required) + 5.5" 1242×2208 |
| Feature graphic | 1024×500 (required, in store-assets) | — |

**LISTING COPY — paste verbatim (2026-07-23; education-first, individual-account posture).**
Do not improvise on submission day. Rules: never use *play / host / bet / wager / stake / casino /
chips / real money / win money* in the title, subtitle, short description, or keywords — use
*learn, study, drills, log, track, keep score, ledger*.

- *App Store name / Play title (≤30):* **`T Poker: Poker Trainer`**
- *Subtitle (iOS, ≤30):* **`Lessons, drills, game ledger`**
- *Short description (Play, ≤80):* **`Poker strategy lessons and daily drills, plus a buy-in ledger for home games.`**
- *Keywords (iOS, ≤100, comma-separated, no spaces):*
  `poker trainer,poker strategy,lessons,quiz,drills,study,preflop,ranges,home game,ledger,tally`
  **Never:** casino, bet, betting, wager, gamble, gambling, stakes, real money, win money, chips, slots, odds.
- *Long description (both stores) — verbatim:*

  > T Poker is a poker strategy trainer — and a simple, honest way to keep score at your home game.
  >
  > **LEARN THE STRATEGY**
  > • Lessons — short written study modules: preflop opening ranges, blind defense, tournament basics, bankroll and mindset.
  > • Daily Quiz — a new set of strategy questions every day, with a written explanation after every answer.
  > • Spot Trainer — decision drills. You get a spot, you choose the line, and you find out why it was right or wrong. 10 free practice questions every day.
  > • Placement test — five questions to set your starting level.
  > • Track your accuracy and your streak as you improve.
  >
  > **KEEP SCORE AT GAME NIGHT**
  > T Poker also replaces the notepad your group already uses. It is a ledger and a calculator — nothing more.
  > • Record what each player put in and what they finished with.
  > • The settlement calculator reduces the whole night to the fewest hand-offs: "Jordan pays Dana $100."
  > • Tournament tools: a blind-level timer, entries and knockouts, and a payout split your group defines by percentage.
  > • Groups and lifetime stats for the regulars — sessions played, results over time, head-to-head.
  > • Works with no account and no internet: tap "Continue as guest" and start.
  >
  > **WHAT T POKER IS NOT**
  > T Poker is not a gambling app. There is no wagering, no deposits, no withdrawals, no payouts and no prizes. Nothing is ever played for money inside the app — the amounts you see are numbers you entered yourself to keep score, and any cash is settled between friends in person, away from your phone.
  >
  > For adults (18+). T Poker is a study and scorekeeping tool, not a gambling product — please play responsibly and within your local laws.

- *Screenshot order (education-first, ten shots):* placement test → lessons → daily quiz → Spot
  Trainer → study hub → home → Final Count → settlements → stats → tournament clock. Play uses
  01–08. Captions and regeneration: `apps/poker-mobile/store-assets/README.md`.

**Positioning & responsible play (keep this framing consistent everywhere):**
T Poker is a **private home-game management and scorekeeping tool for adults
(18+)** — think shared ledger, not casino. It does **not** host real-money play,
wagering, simulated gambling, chips/odds, or payouts; it only records the buy-ins,
cash-outs, and settlements players track among themselves offline. Every listing,
screenshot caption, and reviewer note should reinforce this. Include a short,
non-alarmist responsible-play line in the long description, e.g.: *"For adults
(18+). T Poker is a scorekeeping tool, not a gambling product — please play
responsibly and within your local laws."* This wording also lives in the in-app
Login footer, the Profile → About & Support card, and the privacy policy.

## Step 6 — Category, rating, privacy forms

- **Category:** iOS **primary Education**, secondary **Reference**. Play: app type
  **App (not Game)**, category **Education**. **Never** Games ▸ Casino or Games ▸ Card.
  If Education is ever challenged, fall back to Utilities/Reference — never Lifestyle,
  which pairs badly with a poker name. (Individual-account posture: the education
  classification must be unmistakable — see `release/store-submission-readiness.md`.)

- **Reviewer notes — paste verbatim into App Review Notes and Play's declarations:**

  > Thank you for reviewing T Poker.
  >
  > **RESUBMISSION — what changed since the previous review.** This build resolves both items from the prior rejection:
  > • **Guideline 4.8.0 (Login Services):** Sign in with Apple is now implemented. It is offered on the sign-in screen in the "or continue with" section, alongside Continue with Google, and the app is additionally usable with NO login at all via "Continue as guest" on the same screen. Users who choose to sign in may use Apple, Google, or email. Sign in with Apple requests only name and email, supports Hide My Email, and is not used for advertising — it meets the 4.8.0 requirements. Verified on a physical iPhone: Guest, Google, and Apple sign-in all work.
  > • **Guideline 2.3.6 (Accurate Metadata):** the app name, subtitle, screenshots, and description now lead with the app's primary purpose — poker STRATEGY EDUCATION (written lessons, a daily strategy quiz, a five-question placement test, and decision drills) — with the private home-game SCOREKEEPING ledger as the secondary utility. The age-rating answers below are accurate: there is no gambling and no simulated gambling of any kind in the app. Full detail follows.
  >
  > **WHAT THE APP IS**
  > T Poker is an educational poker-strategy app for adults (18+), plus a scorekeeping utility for private home games.
  > 1) STUDY (the primary experience): written lessons, a daily strategy quiz, a five-question placement test, and decision drills ("Spot Trainer") that present a pre-authored scenario, ask the user to choose the strategically correct action, and then explain why. Progress is scored as correct/incorrect answers, like a flashcard or language-learning app.
  > 2) SCOREKEEPING (the utility): a shared ledger for a friendly home game. One person types in what each player agreed to put in and what they had at the end; the app subtracts and shows who should hand cash to whom in person ("Jordan pays Dana $100"). It is arithmetic on numbers the user types, the same as a split-the-bill app.
  >
  > **WHAT THE APP IS NOT — no real-money gambling of any kind**
  > • No wagering, betting or staking inside the app. Nothing is ever at risk in the app.
  > • No deposits, withdrawals, payouts, prizes or transfers. There is no payment processing, no wallet, no balance, and no connection to any payment provider or bank.
  > • No simulated gambling: no slots/roulette/casino games, no virtual chips to bet, no chance-based outcomes, no random rewards or loot boxes. The Spot Trainer presents a fixed, pre-authored study scenario — it is a quiz question, not a hand of poker.
  > • No in-app purchases and no virtual currency in this version; every feature listed is free.
  > • The dollar figures on the home-game screens are numbers the user typed in to keep score. They record cash that friends settle between themselves, in person, after the app is closed. The app never moves, holds, or processes money — the settlement screen says so on-screen.
  > • No connection to, or affiliation with, any online poker or casino operator.
  >
  > **AUDIENCE**
  > Intended for adults 18+. Not directed at children; no children's/family programme participation, no ads, no third-party ad tracking.
  >
  > **HOW TO REVIEW WITHOUT AN ACCOUNT**
  > Tap "Continue as guest" on launch — no sign-up needed. All of this works offline:
  > • Study ▸ Lessons: open "Preflop Opening Ranges".
  > • Study ▸ Find your level: a five-question placement test.
  > • Study ▸ Daily Quiz: answer a few questions; each shows a written explanation.
  > • Study ▸ Spot Trainer: pick Fold/Call/Raise and read the coaching feedback.
  > • Home ▸ set up a cash game: add 2–3 players, enter buy-ins, tap End Game, enter final chip counts, and see the settlement list ("A pays B $20"). Nothing leaves the device.
  >
  > Privacy policy: https://app.tpoker.app/privacy.html
  > Support: truestorylabs@gmail.com

- **Age rating — COMPLETED on Apple (2026-07-23); this is the direct fix for the 2.3.6 rating
  concern.** The App Store Connect questionnaire was redone honestly: **Gambling: No**;
  **Simulated Gambling: None** (no chance-based play, no virtual chips wagered — outcomes are
  pre-authored quiz scenarios); **Loot Boxes: No**; **Contests: Infrequent/Mild** (friendly
  leaderboards + head-to-head among group members). The calculated rating came back **13+** and
  was deliberately **overridden to 18+** to match our stated audience everywhere else
  (description, in-app Login footer, Profile → About, privacy policy) — 18+ is our declared
  audience, not a claimed content level, so the override is consistent, not a contradiction.
  For Play (IARC), use the same honest answers: **No** to every gambling/simulated-gambling
  question; Target Audience **18+ band only**; Families Policy **No**.
- **Play Data Safety / Apple App Privacy — the production build ships `EXPO_PUBLIC_POSTHOG_KEY`,
  so consent-gated usage analytics IS live and MUST be declared.** The **authoritative,
  code-grounded grid** for BOTH stores (Google Play Data Safety + Apple App Privacy) lives in
  **[release/store-data-safety.md](release/store-data-safety.md)** — file from that, not the older
  `data-safety.md` (now superseded). Summary:
  - **Account data (account users):** email, username, user IDs, and app activity = the game
    records the user enters. App functionality / account management.
  - **Usage analytics (optional, consent-gated):** *Product interaction / App activity* — typed
    usage events (feature used, screen flow, app version, platform, coarse device type) via
    **PostHog (EU), our data processor under their DPA**. Purpose: **Analytics only.** Collection
    starts after the Welcome choice; the **Profile → Privacy opt-out** stops it. Never includes
    amounts, buy-ins/settlements, player names, hand contents, or messages.
  - **The Data-Linked axis matters (Apple):** GUEST analytics use a random app-scoped id ⇒
    **Data NOT Linked to You**; SIGNED-IN analytics call `identify(userId)` ⇒ **Data Linked to
    You** (User ID, purpose Analytics). Declare both, per `store-data-safety.md` — do not blanket
    it as "anonymous."
  - **Tracking = No / "no third-party sharing" holds:** first-party PostHog as processor, no ad
    networks, no cross-app linking, IDFA never read ⇒ answer Apple's *Tracking* question **No**
    (no ATT prompt). Not collected: location, contacts, advertising IDs.
  - Data deletion: in-app (Profile → Delete Account) + privacy policy URL
    `https://app.tpoker.app/privacy.html`.

## Step 7 — Submit

**Android (first time):** Play Console → Testing → Internal testing → create
release → upload the `.aab` **manually** (first upload must be via the console) →
add yourself as tester → promote to Production when satisfied. After that first
upload, `eas submit --platform android --latest` automates future releases.

**iOS:** `eas submit --platform ios --latest` → appears in App Store Connect →
TestFlight (test it!) → add the build to the version page → Submit for Review.

## Step 8 — Final pre-submission checklist

- [ ] **Privacy URL is the RIGHT domain and serves the policy**: open
      `https://app.tpoker.app/privacy.html` in an incognito tab
      — you must see the styled T Poker policy. This is the **canonical URL entered in App
      Store Connect**. Our web app auto-deploys `main` and is also reachable at
      `poker-home-games-three.vercel.app`, which **307-redirects** to `app.tpoker.app` — always
      declare the `app.tpoker.app` URL on the stores. NOTE: `t-poker.vercel.app` is a DIFFERENT,
      third-party site (a Japanese GTO poker app) that we do not own — never use it anywhere.
      Data-safety deletion URL:
      `https://app.tpoker.app/privacy.html#delete`.
- [ ] **APK networking**: install the newest preview APK and SIGN IN on a phone —
      builds before `aaf473f` shipped a dead LAN API fallback (fixed via eas.json
      env); any build from `99e9d17e` onward has the production URL baked in.
- [ ] `npx tsc --noEmit` · `npx jest` · `npx expo-doctor` all clean
- [ ] Browser regression (drive harness) green
- [ ] Manual pass on a real device from the latest preview build: guest cash game
      end-to-end · tournament end-to-end · sign-in (email + Google after the
      OAuth external steps) · push permission prompt
- [x] **Sign-in verified on a physical iPhone (2026-07-23):** Guest, Google, AND Apple sign-in all work
      from the preview build. Native Google OAuth is fully wired (iOS + Android clients for `com.tpoker.app`,
      env client IDs in `eas.json`, backend `GoogleSettings:ClientIds`, and the reversed-client-ID
      `CFBundleURLTypes` scheme in `app.json`); Sign in with Apple is implemented (`usesAppleSignIn` +
      `expo-apple-authentication`, `AppleAuthButton`/`useAppleAuth`). Web Google sign-in also verified.
      (Expo Go can't do Google — store build unaffected.)
- [ ] Push credentials uploaded (Step 3) if you want push live at launch
      (optional — app degrades gracefully to in-app inbox)
- [ ] Production backend healthy (Railway `/health`), Vercel privacy.html live
- [ ] Version bumped in app.json; release notes written

**Recommended order overall:** Step 1 (both accounts) → 2 → 3 (Play key + iOS creds)
→ 4 (production builds) → 5–6 (listings, can run in parallel with builds) →
7 (internal/TestFlight first, then production) → 8 before every submit.
