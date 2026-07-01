# Google Sign-In — Diagnosis & Fix Checklist

> **Status — VERIFIED working on web (2026-07).** The owner tested the deployed web app
> (`poker-home-games-three.vercel.app → Sign In → Continue with Google`) and it signed in to Home.
> The whole chain — app code → Google Cloud Console → backend audience list — is confirmed correct.
> **Google sign-in in Expo Go is expected NOT to work** (an SDK-54 platform limitation, explained
> below — it is not a bug and not fixable). For the real mobile app, do the native OAuth setup in
> **§4** as part of store-build prep.

---

## Why Google sign-in fails in Expo Go (and why it's NOT a production bug)

**Symptom** (Expo Go on iPhone/Android, tapping "Sign in with Google"):
> `Access blocked: Authorization Error` → **`invalid_request` (400)** — "You can't sign in to this app
> because it doesn't comply with Google's OAuth 2.0 policy."

**Mechanism:**
- Expo Go runs as **Expo's own app** (`host.exp.Exponent`), not `com.tpoker.app`, so it cannot use the
  app's native OAuth clients or claim their URL schemes.
- SDK 54 / `expo-auth-session` v5 **removed the `auth.expo.io` proxy** that used to hand Expo Go a valid
  HTTPS redirect. Without it, the `redirect_uri` sent to Google becomes an **`exp://…`** URL (the Expo Go
  dev-server address).
- Google's OAuth 2.0 policy **rejects non-HTTPS / custom-scheme redirects** for this flow → exactly the
  error above. **This cannot be fixed in the Google Console** — Google will not allow `exp://` on a web
  OAuth client.

**Tell-tale:** the error is `invalid_request` / "policy" — **not** `redirect_uri_mismatch` (which is the
*web* registration error). Different error ⇒ this is the Expo Go scheme/policy limitation, not a web or
Console problem. (Web was independently verified working, confirming this.)

**Two ways to actually use Google sign-in:**
1. **Web** — the deployed Vercel site or `npm run web` (:8081). ✅ verified working. Uses the web client
   (`eruvq9…`) with an HTTPS/localhost origin redirect Google accepts (see §2).
2. **A native build** (EAS **dev** client or a standalone/store build — **not Expo Go**). Needs the
   iOS/Android OAuth clients **and** the reversed-client-ID iOS URL scheme (see §4).

---

## How the OAuth is wired (`apps/poker-mobile/src/hooks/useGoogleAuth.ts`)

`expo-auth-session`'s `useIdTokenAuthRequest` picks the client + `redirect_uri` per platform:

| Platform | Client used | redirect_uri sent to Google | Works? |
|----------|-------------|-----------------------------|--------|
| **Web** (Vercel / `npm run web`) | `webClientId` = `eruvq9…` | the page **origin** (`https://poker-home-games-three.vercel.app` or `http://localhost:8081`) | ✅ yes — origin registered in the Console (§2) |
| **Native build** (EAS iOS/Android) | `iosClientId` / `androidClientId` | reversed-client-ID scheme (`com.googleusercontent.apps.…://`), tied to bundle `com.tpoker.app` | ✅ once §4 is done |
| **Expo Go** | falls to the base web client + `exp://` | `exp://…` | ❌ rejected by Google (limitation) |

The backend (`GoogleSettings:ClientIds`) allow-lists all client IDs, so token-**audience** validation is
not the issue.

---

## Root cause of the ORIGINAL failure (fixed in-repo)

`GoogleSettings:ClientIds` was **empty** in both `appsettings.json` and `appsettings.Production.json`.
The backend validates every Google ID token's audience against this list (`GoogleAuthService.cs` →
`GoogleJsonWebSignature.ValidateAsync`), so an empty list rejected **every** Google sign-in on **every**
platform with 401 "Invalid Google token" — even when the Google popup itself succeeded.

**Fixed:** all three known public client IDs are committed to both files. A Railway redeploy picks this up
automatically. (Client IDs are public identifiers — not secrets.)

## External steps — YOU must do these (not possible from the repo)

### 1. Railway (backend) — done
The committed `appsettings.Production.json` carries the ClientIds, so **no env var is strictly required**.
If you ever prefer env-only config or add new clients without a deploy:

```
GoogleSettings__ClientIds__0 = 12435044751-jdh0dldfhkn2h8hqs3ssegbjflhvcmfi.apps.googleusercontent.com
GoogleSettings__ClientIds__1 = 12435044751-eruvq9uduc9sk5mietg9eiab2epddsp6.apps.googleusercontent.com
GoogleSettings__ClientIds__2 = 12435044751-jap7j5prc6vm0eh0mj517nv0phrlu8mr.apps.googleusercontent.com
```
⚠️ Env vars REPLACE matching config keys index-by-index; keep the full list. When you add the iOS/Android
store clients (§4), append them here too.

### 2. Google Cloud Console — required for ALL web sign-in (Vercel AND local) — done + verified
[console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0
Client `12435044751-eruvq9uduc9sk5mietg9eiab2epddsp6…` (**Web**):

- **Authorized JavaScript origins** must include:
  - `https://poker-home-games-three.vercel.app`
  - `http://localhost:8081` (local web dev)
- **Authorized redirect URIs** must include (Google matches these **character-for-character** — scheme,
  host, **port**, and trailing slash all count):
  - `https://poker-home-games-three.vercel.app` (and the `/` variant)
  - `http://localhost:8081` **and** `http://localhost:8081/`

> The web `redirect_uri` is the page **origin**. `npm run web` is pinned to port **8081** so the origin
> stays `http://localhost:8081`. The exact value is printed to the browser console (dev only) as
> `[google] redirectUri = …`.

### 3. Vercel — done (belt-and-braces)
Project → Settings → Environment Variables:
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 12435044751-eruvq9uduc9sk5mietg9eiab2epddsp6.apps.googleusercontent.com
```
(The code falls back to this same ID.) Redeploy after.

### 4. Native Google sign-in — REQUIRED before any store build (⚠️ not done yet)

Web works without this; **the native iOS/Android app does NOT**. The app currently references
`jap7j5…` as `iosClientId` and falls back to the web client for Android — but a real device build needs
proper **native** OAuth clients for `com.tpoker.app` **and** the reversed-client-ID iOS URL scheme (which
is currently **missing** from `app.json`). This is a store-build prerequisite — see the ready-to-apply
step in `docs/store-release.md` (Step 3) and `docs/release/eas-build.md`.

**a) Create the native OAuth clients** (Google Cloud Console → Credentials → Create credentials → OAuth
client ID):
- **iOS** type, **Bundle ID `com.tpoker.app`** → note the new client ID. Google shows an **iOS URL scheme**
  = the reversed client ID, `com.googleusercontent.apps.12435044751-<iosSuffix>`.
  *(Confirm whether the existing `jap7j5…` is already an iOS-type client for `com.tpoker.app`; if it is,
  use it and its reversed ID. If it's a web/other type, create a new iOS client.)*
- **Android** type, **Package `com.tpoker.app`** + the **release SHA-1** fingerprint. Get the SHA-1 from
  `eas credentials` → Android → Keystore (the release/upload key EAS manages).

**b) Set the EAS env vars** (`eas.json` → `build.<profile>.env`, or EAS project secrets):
```
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID     = 12435044751-<iosSuffix>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = 12435044751-<androidSuffix>.apps.googleusercontent.com
```

**c) Append both new client IDs to the backend allow-list** `GoogleSettings:ClientIds` (appsettings +
deploy, or the Railway env vars in §1). Token audience validation fails otherwise.

**d) Add the iOS URL scheme to `app.json`** — **CURRENTLY MISSING.** `expo-auth-session` returns to the
app via the reversed-client-ID URL scheme; iOS won't resolve the redirect without it registered. This is
a *ready-to-apply* change — **do NOT commit it until you do the store build** (put your real iOS reversed
client ID in place of the placeholder):

```jsonc
// apps/poker-mobile/app.json  →  expo.ios
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.tpoker.app",
  "infoPlist": {
    "ITSAppUsesNonExemptEncryption": false,
    "CFBundleURLTypes": [
      { "CFBundleURLSchemes": ["com.googleusercontent.apps.12435044751-<iosSuffix>"] }
    ]
  }
}
```
> Android needs no scheme change — the reversed-client-ID intent is derived from the package + SHA-1 you
> registered in step (a).

**e) Build with EAS (not Expo Go)** and install on the device:
```
eas build --profile development --platform ios     # dev client, to test Google before store
eas build --profile production  --platform ios     # / android — the store build
```
Google sign-in then works in the installed app (Expo Go still won't — that's expected).

---

## How to verify

| Platform | Test |
|----------|------|
| **Web (Vercel)** | ✅ **VERIFIED (owner, 2026-07):** poker-home-games-three.vercel.app → Sign In → Continue with Google → lands on Home. |
| Local web | `npm run web` + backend running → same flow against `localhost:8081`. |
| **Expo Go** | ⚠️ **Not supported (SDK 54 limitation) — expected, not a bug.** Produces `invalid_request` / "doesn't comply with OAuth 2.0 policy" because the redirect is `exp://` (proxy removed). Test Google on **web** or a **native/dev build** — never Expo Go. |
| Native build (after §4) | EAS dev/standalone build on a real device → Sign in with Google → lands on Home. |
| Email/password | Unaffected on every platform — regression-checked in CI gate. |

## Code changes made in-repo
- `src/PokerApp.API/appsettings.json` + `appsettings.Production.json`: populated ClientIds.
- `src/hooks/useGoogleAuth.ts`: corrected an outdated comment (no auth.expo.io proxy in SDK 54); added a
  `__DEV__` diagnostic that logs the exact `redirectUri`.
- **Pending for store build (NOT applied):** the `app.json` iOS `CFBundleURLTypes` scheme in §4(d).
