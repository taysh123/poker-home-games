# T Poker — Store Release Readiness (Google Play + Apple App Store)

_Last updated: June 16, 2026 · Publisher (seller of record): **Tay Shofer** · App version: 1.1.1 (resubmission)_

> **Premium redesign merged + live (June 16, 2026).** PR #1 (typography v2 with Sora,
> app-wide BrandHeader logo home anchor, per-screen cinematic depth, 5 wow moments)
> is merged to `main` and deployed to production. Verified end-to-end on the live
> Vercel + Railway deployment: web SPA + invite routing, `/health` Healthy, CORS active,
> authed drive (Home/Stats/Sessions/Groups/Notifications/Invitations/Profile) all 200,
> Leave Group + Achievements live, guest flow 0 console errors. Store screenshots
> regenerated from the merged build.

Canonical, living readiness report for launching T Poker on both stores. Updated
as blockers clear.

## Scores

| | **Google Play** | **Apple App Store** |
|---|---|---|
| Readiness | **93 / 100** | **80 / 100** |
| Gating factor | External (Play account + listing forms + device QA) | Apple account + iOS build/credentials not done yet |
| Production build | ✅ AAB built & ready (`f009e063`, v1.1.0, vc 2) | ❌ not built yet (`eas build -p ios`) |

All code, assets, privacy, and compliance are in place. The remaining points are
**external actions only you can do** — there are no open in-repo blockers.

### Latest hardening pass (June 17, 2026)
- **Owner can leave a group:** fixed the 409 that blocked a group creator from leaving.
  Owner leaving with members remaining auto-transfers ownership (prefer Admin, else
  longest-standing member); a sole owner leaving deletes the empty group. `GET /api/groups/{id}`
  now returns the caller's `myRole`. Verified on production with `verify-leave-owner.js`.

### Hardening pass (June 15, 2026)
- **Group flow fixed:** Leave/Delete Group work on web; invite links no longer 404
  (SPA rewrite at `apps/poker-mobile/vercel.json` + React Navigation `linking`),
  verified live on production.
- **App-wide Inter typography** (DM Serif retained for hero titles/numerals) via a
  global Text font resolver.
- **Web confirmation bug fixed app-wide:** `Alert.alert` is a no-op on react-native-web,
  so destructive confirms (incl. **Delete Account**) silently did nothing on the web
  app — migrated to `confirmDialog`/`showToast` across Profile, Session, Invitations,
  PendingSettlements, NewGame. (Native store builds were never affected.)
- **Stat value clip fixed** on web; **store screenshots regenerated** from the final build.
- Verified: tsc clean · jest 59/59 · `dotnet build` clean · web export clean · guest
  harness green (0 console errors) · authed live-production drive green (all API screens load).

## What's done (both stores)

- ✅ **App is feature-complete & stable** — cash + a serious tournament director
  (custom payouts, editable blinds, controllable clock, late-reg, rebuys/add-ons,
  live dashboard, early finish). tsc clean, 59 unit tests, web regression green.
- ✅ **Store screenshots** regenerated at exact sizes for all three frames
  (`play-phone` 1080×1920, `ios-6.7` 1290×2796, `ios-5.5` 1242×2208) — now show the
  new tournament dashboard + podium. In `apps/poker-mobile/store-assets/`.
- ✅ **Icon / adaptive icon / feature graphic** present and valid (adaptive icon in
  the Android safe zone).
- ✅ **Privacy policy** live at `https://app.tpoker.app/privacy.html`
  (+ `#delete` anchor) — operated by Tay Shofer, 18+, not-a-gambling-product, data +
  deletion sections.
- ✅ **Compliance posture** — non-gambling scorekeeping positioning, adults (18+),
  contact `truestorylabs@gmail.com`. Category guidance: Lifestyle/Tools, **not
  Casino**.
- ✅ **Bundle id** `com.tpoker.app`, deep-link scheme, `ITSAppUsesNonExemptEncryption:false`.

---

## Google Play — remaining steps (in order)

1. **Create Play Console account** ($25 one-time). Developer (publisher) name =
   **Tay Shofer** (legal name — individual account); support email = `truestorylabs@gmail.com`.
2. **Create the app** → "T Poker", App (not Game), Free.
3. **Upload the AAB** (already built): download
   `https://expo.dev/artifacts/eas/LoSevqnl6wrnJD3KlzUo-CYhusn16GHpa8ds8TqwYi0.aab`
   → Testing → Internal testing → Create release → upload manually (first upload
   must be via console; afterwards `eas submit -p android --latest`).
4. **Complete listing**: short/long description (copy in store-release.md),
   upload `store-assets/screenshots/play-phone/*` + feature graphic + 512 icon.
5. **Forms**: Data Safety (deletion URL `…/privacy.html#delete`), content rating
   (answer NO to gambling/simulated gambling; adult audience), category
   Lifestyle/Tools, privacy URL.
6. **Device QA** the corrected APK/AAB: install, sign in (email + Google), run a
   guest cash game and a tournament end-to-end.
7. **Roll out** Internal testing → review → Production.

**Optional before launch:** add the Google OAuth Android client (release SHA-1 via
`eas credentials`) + the `https://poker-home-games-three.vercel.app` web origin for
Google sign-in; FCM push key via `eas credentials` (app degrades gracefully without
it).

## Apple App Store — remaining steps (in order)

1. **Enroll in the Apple Developer Program** ($99/year) — required for any iOS
   distribution (even TestFlight).
2. **Register the bundle id** `com.tpoker.app` at developer.apple.com → Identifiers.
3. **Create the app** in App Store Connect → note the numeric **Apple ID of the
   app** (`ascAppId`); find your **Team ID** under Membership.
4. **Fill `eas.json`** `submit.production.ios` placeholders `appleTeamId` +
   `ascAppId` (currently `SET_ME_*`).
5. **iOS credentials**: run `eas credentials` (iOS) → let EAS create the
   distribution cert + provisioning profile; add the APNs key if you want push.
6. **Build**: `eas build -p ios --profile production` → `.ipa`.
7. **Submit**: `eas submit -p ios --latest` → TestFlight (test it) → add build to
   the version page → complete the same listing + Privacy Nutrition + age (17+)
   forms → Submit for Review.
8. **Device QA** on a real iPhone (sign-in + a cash game + a tournament).

## Remaining blockers
- **None in-repo.** Hard gates left are external: store accounts, the iOS build, and
  device QA on real hardware.

## Recommended next milestone
**Google Play Internal testing track** — create the account, upload the existing
AAB, complete the forms, and device-QA on your phone. That single milestone
exercises the real Play pipeline end-to-end. Do iOS second (it needs the paid Apple
account + an iOS build), and run the Google OAuth console steps alongside Play so web
+ Google sign-in are verified together.

_See also: [store-release.md](store-release.md) (full step-by-step),
[google-oauth-fix.md](google-oauth-fix.md), [tournament-mode.md](tournament-mode.md)._
