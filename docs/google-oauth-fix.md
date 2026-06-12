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

### 2. Google Cloud Console — required for web sign-in on Vercel
[console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
Credentials → OAuth 2.0 Client `12435044751-eruvq9uduc9sk5mietg9eiab2epddsp6…` (Web):

- **Authorized JavaScript origins** must include:
  - `https://t-poker.vercel.app`
  - `http://localhost:8081` (local web dev)
- **Authorized redirect URIs**: add `https://t-poker.vercel.app` (and `/` variant).

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
| Web (Vercel) | Open t-poker.vercel.app → Sign In → Continue with Google → should land on Home. If the Google popup succeeds but the app shows an error, the backend list is wrong; if the popup itself errors ("origin not allowed"), step 2 is incomplete. |
| Local web | `npm run web` + backend running → same flow against localhost. |
| Expo Go | Scan QR → Continue with Google. Token validation now passes (backend fix). |
| Email/password | Unaffected — regression-checked in CI gate. |

## Code changes made in-repo
- `src/PokerApp.API/appsettings.json` + `appsettings.Production.json`: populated ClientIds.
- `src/hooks/useGoogleAuth.ts`: corrected an outdated comment (no auth.expo.io proxy in SDK 54).
