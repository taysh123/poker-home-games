# EAS native build path (documented — not yet submitted)

> Status: **reference only.** This documents how to produce iOS/Android builds with EAS for the
> Subsystem 1 launch. No store build is submitted as part of this work (Phase 1 ships web-verified;
> native store submission is a separate, human-gated step — see `docs/release/v2-merge-readiness.md`).
> Optional store accounts (Apple Developer $99/yr, Google Play $25 one-time) are only needed if/when
> store builds are actually pursued.

## Prerequisites

- EAS CLI `>= 16.0.0` (`eas.json` pins `cli.version`). Install: `npm i -g eas-cli`. Authenticate: `eas login`.
- Run all `eas build` commands from `apps/poker-mobile/` (the Expo project root).
- `appVersionSource` is `remote` — EAS owns the build number; `autoIncrement` is on for `beta` and
  `production`, so each build bumps automatically.

## Build profiles (from `eas.json`)

| Profile | Distribution | Channel | Variant / flags | Use |
|---------|--------------|---------|-----------------|-----|
| `development` | internal (dev client) | — | dev (`__DEV__` overrides) | Local debugging on a device with the dev client. |
| `preview` | internal | — | production flags (no `EXPO_PUBLIC_APP_VARIANT`) | Internal sanity build that behaves like prod. |
| `beta` | internal (extends `preview`) | `beta` | `EXPO_PUBLIC_APP_VARIANT=beta` ⇒ `BETA_FLAGS` (full V2 preview, paywall OFF) | Hand to testers to exercise the whole V2 surface in a real build. |
| `production` | store | (default) | production flags only | The store build. nav5 + onboardingV2 ON; all other flags OFF. |

## Required environment per profile

EAS reads `build.<profile>.env` from `eas.json` at build time. The values currently committed:

| Var | preview / beta / production | Notes |
|-----|------------------------------|-------|
| `EXPO_PUBLIC_API_URL` | `https://poker-home-games-production.up.railway.app` | Backend (Railway). |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `12435044751-eruvq9uduc9sk5mietg9eiab2epddsp6.apps.googleusercontent.com` | Google OAuth (web client id; the app falls back to public client IDs for native OAuth on SDK 54). |
| `EXPO_PUBLIC_APP_VARIANT` | `beta` (beta profile only) | Activates `BETA_FLAGS` in `src/config/features.ts`. Unset on `preview`/`production` ⇒ `PROD_FLAGS`. |

> Optional native-OAuth overrides (only if you stop using the public fallback client IDs):
> `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`. Not required for the
> current build profiles.

## Build commands

```powershell
# from apps/poker-mobile
eas build --profile production --platform ios
eas build --profile production --platform android
# tester build that previews the full V2 surface (paywall OFF):
eas build --profile beta --platform android
```

## Submission (NOT performed here)

`submit.production` in `eas.json` is pre-wired:
- iOS: `appleTeamId = J2MGQU5C7U`, `ascAppId = 6781109023`.
- Android: `serviceAccountKeyPath = ./play-service-account.json` (gitignored — must be present locally), `track = internal`.

When store submission is approved, run (documented for completeness — do not run as part of Subsystem 1):

```powershell
eas submit --profile production --platform ios --latest
eas submit --profile production --platform android --latest
```

## Pre-submission gates

Before any store build, all repo gates must be green (see `docs/release/v2-merge-readiness.md`):
`npx tsc --noEmit` · `npx jest` · `npx expo export -p web` (this subsystem has no backend changes,
so `dotnet build` / `dotnet test` are unaffected). Confirm `PROD_FLAGS` still has only `nav5` +
`onboardingV2` ON (guarded by `src/config/__tests__/features.test.ts`).
