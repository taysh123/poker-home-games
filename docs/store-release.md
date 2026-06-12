# T Poker — App Store Release Checklist

Everything needed to ship `apps/poker-mobile` to TestFlight / Play Console via EAS.
Items marked **(you)** require credentials only the account owner can supply.

## Already configured

- Bundle IDs: `com.tpoker.app` (iOS + Android), scheme `tpoker`, deep links via
  `applinks:t-poker.vercel.app`
- Icons, adaptive icon, splash (assets/), dark UI, portrait, New Architecture enabled
- EAS project (`eas.json`: development / preview / production profiles, production
  `autoIncrement` for build numbers)
- Privacy policy: https://t-poker.vercel.app/privacy.html (source: `PRIVACY.md`)
- Guest mode: app is fully reviewable without an account (App Review requirement
  4.8 / "login wall" concerns avoided)

## One-time setup (you)

### Apple
1. Apple Developer Program membership ($99/yr) — note your **Team ID**.
2. Create the app in App Store Connect (bundle `com.tpoker.app`) — note the
   **ASC App ID** (numeric).
3. Create an App Store Connect **API key** (Users & Access → Integrations) and run
   `eas credentials` once to store it, or let `eas submit` prompt you.
4. Fill `submit.production.ios` in `eas.json` (`appleTeamId`, `ascAppId`).

### Google
1. Google Play Console account ($25 one-time). Create the app (package
   `com.tpoker.app`).
2. Create a **service account** with "Release manager" permissions, download the
   JSON key, save it as `apps/poker-mobile/play-service-account.json`
   (gitignored — never commit).
3. First AAB must be uploaded manually through the Play Console UI before
   `eas submit` can manage releases.

### Push notification credentials (required since the push foundation shipped)
- **Android**: EAS needs an FCM v1 service-account key — Firebase console →
  create/link the project → Project settings → Service accounts → generate key →
  upload via `eas credentials` (Android → Push notifications). Expo Go testing
  works WITHOUT this; production builds need it.
- **iOS**: an APNs key (requires the paid Apple Developer account) — `eas credentials`
  walks you through creating/uploading it. Remote push does NOT work in Expo Go on
  iOS; test with an EAS development build.
- The app config plugin (`expo-notifications`, gold accent color) is already set
  in app.json.

### Google OAuth (for "Continue with Google" in store builds)
- Create **Android** OAuth client (package + release-keystore SHA-1 — get it from
  `eas credentials` after the first build) → set `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.
- Create **iOS** OAuth client (bundle ID) → set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- Set both as EAS env vars: `eas env:create --scope project` (or in eas.json `env`).

## Build & submit

```powershell
cd apps/poker-mobile

# Internal test build (installable APK / simulator-free iOS)
eas build --profile preview --platform all

# Production builds
eas build --profile production --platform all

# Submit (after one-time setup above)
eas submit --platform ios --latest
eas submit --platform android --latest
```

## Store listing assets still needed (you)

- Screenshots: 6.7" + 5.5" iPhone, 12.9" iPad (if tablet support kept), Android
  phone + 7"/10" tablet. Run the app via `npm run web` at device sizes or capture
  from a device/simulator.
- App description, keywords, promo text. Category: Lifestyle or Utilities (NOT
  Casino/Gambling — T Poker handles no wagers; emphasize "scorekeeping for private
  home games" in review notes to avoid gambling-policy misclassification).
- Age rating questionnaire: select "simulated gambling: none" — the app tracks
  ledgers, it does not offer gambling. Apple may still ask; the review note matters.
- Support URL + marketing URL (the Vercel site works for both).

## Per-release

1. Bump `version` in `app.json` (build numbers auto-increment via EAS).
2. `npx tsc --noEmit && npx jest` green.
3. `eas build --profile production --platform all`
4. `eas submit` both platforms.
5. Tag the repo: `git tag vX.Y.Z && git push --tags`.
