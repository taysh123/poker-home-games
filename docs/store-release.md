# T Poker — App Store Release Guide (Android + iOS)

A complete, ordered, follow-along guide from today's state to published apps.
Everything code-side is DONE (v1.1.0, expo-doctor 18/18, working preview APKs,
notifications plugin, privacy policy live, in-app account deletion). What remains
is accounts, credentials, listings — things only you can do.

**Current proof point:** EAS preview builds produce real installable APKs
(expo.dev → taysh/t-poker → Builds). Production builds use the exact same
pipeline with store packaging.

---

## Step 0 — What's in-code vs outside VS Code

| Done in-code (✅ shipped) | You must do outside VS Code |
|---|---|
| Bundle IDs `com.tpoker.app`, scheme, deep links | Create the store accounts |
| Icons/splash/notification color config | Play service-account key; Apple Team/ASC IDs |
| v1.1.0 + auto-incrementing build numbers | Push credentials (FCM v1, APNs) via `eas credentials` |
| Privacy policy at t-poker.vercel.app/privacy.html | Google OAuth iOS/Android clients (see google-oauth-fix.md) |
| In-app account deletion (Profile) | Store listings: text, screenshots upload, data-safety forms |
| Guest mode (reviewers need no account) | Final manual device test + submit clicks |
| Store screenshots + feature graphic (store-assets/) | Optional: designer pass on those assets |

---

## Step 1 — Accounts (one-time)

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
- **Google sign-in clients for store builds:** follow [google-oauth-fix.md](google-oauth-fix.md) §4 (create iOS + Android OAuth clients; the Android one needs the release SHA-1, which you get from `eas credentials` → Android → Keystore). Add both IDs to the backend ClientIds and the EAS env (`EXPO_PUBLIC_GOOGLE_*`).

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

**Suggested copy** (edit to taste):
- *Short description (80):* "Run your home poker night — buy-ins, settlements, tournaments. No spreadsheets."
- *Long description:* lead with guest mode (works instantly, no account), settlements ("Bob pays Alice ₪40"), tournament mode (blind clock, podium payouts), groups/stats for regulars. Avoid gambling language — this is a scorekeeping tool.

## Step 6 — Category, rating, privacy forms

- **Category:** Lifestyle or Utilities/Tools. **NOT Casino/Card games.** Add a
  reviewer note on both stores: *"T Poker is a scorekeeping and expense-settlement
  tool for private home games. It contains no wagering, no real-money play, no
  chips/odds simulation, and no payouts — it only records what players track
  themselves, like a spreadsheet."*
- **Age rating questionnaires:** answer "no" to gambling/simulated gambling
  (nothing is wagered in-app). Expect 12+/Teen-ish outcomes from other axes.
- **Play Data Safety / Apple Privacy Nutrition:** derived from [PRIVACY.md](../PRIVACY.md):
  - Collected (account users only): email address, username (account management);
    app activity = game records the user enters. All optional — guest mode collects nothing.
  - Not collected: location, contacts, identifiers for ads. No third-party sharing. No ads.
  - Data deletion: in-app (Profile → Delete Account) + privacy policy URL
    `https://t-poker.vercel.app/privacy.html`.

## Step 7 — Submit

**Android (first time):** Play Console → Testing → Internal testing → create
release → upload the `.aab` **manually** (first upload must be via the console) →
add yourself as tester → promote to Production when satisfied. After that first
upload, `eas submit --platform android --latest` automates future releases.

**iOS:** `eas submit --platform ios --latest` → appears in App Store Connect →
TestFlight (test it!) → add the build to the version page → Submit for Review.

## Step 8 — Final pre-submission checklist

- [ ] `npx tsc --noEmit` · `npx jest` · `npx expo-doctor` all clean
- [ ] Browser regression (drive harness) green
- [ ] Manual pass on a real device from the latest preview build: guest cash game
      end-to-end · tournament end-to-end · sign-in (email + Google after the
      OAuth external steps) · push permission prompt
- [ ] Google sign-in external steps done (google-oauth-fix.md) and verified on web
- [ ] Push credentials uploaded (Step 3) if you want push live at launch
      (optional — app degrades gracefully to in-app inbox)
- [ ] Production backend healthy (Railway `/health`), Vercel privacy.html live
- [ ] Version bumped in app.json; release notes written

**Recommended order overall:** Step 1 (both accounts) → 2 → 3 (Play key + iOS creds)
→ 4 (production builds) → 5–6 (listings, can run in parallel with builds) →
7 (internal/TestFlight first, then production) → 8 before every submit.
