# Google Sign-In — Diagnosis & Fix Checklist

## Root cause (fixed in-repo)

`GoogleSettings:ClientIds` was **empty** in both `appsettings.json` and
`appsettings.Production.json`. The backend validates every Google ID token's
audience against this list (`GoogleAuthService.cs` → `GoogleJsonWebSignature.ValidateAsync`),
so an empty list rejected **every** Google sign-in on **every** platform with
401 "Invalid Google token" — even when the Google popup itself succeeded.

**Fixed:** all three known public client IDs are now committed to both files.
A Railway redeploy picks this up automatically. (Client IDs are public
identifiers — not secrets.)

## External steps — YOU must do these (not possible from the repo)

### 1. Railway (backend) — required once
After this commit deploys, the committed `appsettings.Production.json` already
carries the ClientIds, so **no env var is strictly required**. But if you ever
prefer env-only config or add new clients without a deploy:

```
GoogleSettings__ClientIds__0 = 12435044751-jdh0dldfhkn2h8hqs3ssegbjflhvcmfi.apps.googleusercontent.com
GoogleSettings__ClientIds__1 = 12435044751-eruvq9uduc9sk5mietg9eiab2epddsp6.apps.googleusercontent.com
GoogleSettings__ClientIds__2 = 12435044751-jap7j5prc6vm0eh0mj517nv0phrlu8mr.apps.googleusercontent.com
```
⚠️ Env vars REPLACE matching config keys index-by-index; keep the full list.

### 2. Google Cloud Console — required for ALL web sign-in (Vercel AND local)
[console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
Credentials → OAuth 2.0 Client `12435044751-eruvq9uduc9sk5mietg9eiab2epddsp6…` (Web):

- **Authorized JavaScript origins** must include:
  - `https://poker-home-games-three.vercel.app`
  - `http://localhost:8081` (local web dev)
- **Authorized redirect URIs** must include (Google matches these **character-for-character** — scheme,
  host, **port**, and trailing slash all count):
  - `https://poker-home-games-three.vercel.app` (and the `/` variant)
  - `http://localhost:8081` **and** `http://localhost:8081/` ← **this was the missing entry** behind
    `Error 400: redirect_uri_mismatch` on `npm run web` (localhost had only been added as a JS origin).

> The web `redirect_uri` is the page **origin**. `npm run web` is pinned to port **8081**
> (`apps/poker-mobile/package.json` → `expo start --web --port 8081`) so the origin stays
> `http://localhost:8081` and matches the entry above. If you must use a different port, register that exact
> `http://localhost:<port>` instead. The exact value is printed to the browser console (dev only) as
> `[google] redirectUri = …`.

### 3. Vercel — recommended
Project → Settings → Environment Variables:
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 12435044751-eruvq9uduc9sk5mietg9eiab2epddsp6.apps.googleusercontent.com
```
(The code falls back to this same ID, so this is belt-and-braces.) Redeploy after.

### 4. For future iOS/Android store builds — not needed yet
Create OAuth clients in Google Cloud Console:
- **iOS** type, bundle `com.tpoker.app` → set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (EAS env)
- **Android** type, package `com.tpoker.app` + the release SHA-1 from `eas credentials`
  → set `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- Append BOTH new IDs to the backend ClientIds list (env var or appsettings + deploy).

## How to verify after the external steps

| Platform | Test |
|----------|------|
| Web (Vercel) | Open poker-home-games-three.vercel.app → Sign In → Continue with Google → should land on Home. If the Google popup succeeds but the app shows an error, the backend list is wrong; if the popup itself errors ("origin not allowed"), step 2 is incomplete. |
| Local web | `npm run web` + backend running → same flow against localhost. |
| Expo Go | ⚠️ **Not supported on SDK 54** — web-type client + `exp://` redirect ⇒ `redirect_uri_mismatch` (the auth.expo.io proxy was removed). Test Google on local web or a dev build with native iOS/Android clients. |
| Email/password | Unaffected — regression-checked in CI gate. |

## Code changes made in-repo
- `src/PokerApp.API/appsettings.json` + `appsettings.Production.json`: populated ClientIds.
- `src/hooks/useGoogleAuth.ts`: corrected an outdated comment (no auth.expo.io proxy in SDK 54).
