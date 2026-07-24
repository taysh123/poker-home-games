# Dual-Store Submission — iOS update + first Google Play release (v1.2.0)

> Plan of record for shipping the next version (Wave 2 features: 2.5 top-movers, 2.4, 2.2, E.1) to
> **both** stores under one marketing version, **1.2.0**. Written 2026-07-25.
>
> **The single most important fact:** iOS and Android will NOT go live at the same time. Android is
> gated behind a **14-day closed test** (see §2) that iOS has no equivalent of. Plan for **iOS 1.2.0
> shipping first**, Android 1.2.0 following once its closed test + production-access review clear.
> The **version numbers stay in sync (both 1.2.0); the release dates will not.**

---

## 1. Status / what's already done

| Item | State |
|---|---|
| iOS 1.1.1 (build 11) | ✅ **Approved & releasing** on the App Store |
| Google Play Console account | ✅ Exists (personal account) |
| Play app record | ✅ Created — `com.tpoker.app` |
| Play assets (screenshots, feature graphic, icons) | ✅ In `apps/poker-mobile/store-assets/` (`play-phone/` 01–10, `feature-graphic-1024x500.png`, `icon-512.png`) — **but pre-Wave-2; need regen, see §5** |
| Android submit config | ✅ `eas.json` `submit.production.android` (`play-service-account.json`, track) |
| Android Google OAuth | ✅ client IDs wired; release SHA-1 matches the EAS keystore |
| **Play production access** | ❌ **BLOCKED** — see §2 |

---

## 2. THE CRITICAL PATH — Play's 14-day closed-testing gate

Personal Play Console accounts must run a **closed test with ≥12 testers for ≥14 continuous days**,
then **apply for production access** (Google reviews the testing) before "Production" is unlockable.
Right now: **0 of 12 testers**, so "Promote to Production" is not available.

This is the **longest lead time in the whole release** — ~14 days minimum, plus recruiting testers and
the production-access review. **Everything else (iOS review, our builds, screenshots) is faster.** So the
Android track is planned backwards from this clock.

**Key mechanics that shape the strategy:**
- The 14-day window measures **testers being opted-in and the test running** — it is NOT tied to a
  specific build. **Updating the closed-track build does NOT reset the clock.**
- Therefore the clock should start **as early as possible**, with *whatever build is ready* — it does not
  have to be the finished 1.2.0.

### ⭐ Recommendation: start the clock NOW (don't wait for 1.2.0)

**Push an Android build into closed testing today, off current `main`, and start recruiting the 12
testers immediately.** Rationale:
- The 14-day clock is the bottleneck; every day of waiting is a day added to Android's timeline.
- `main` already contains the merged Wave-2 work (QR invites, 2.5 top-movers, "You") beyond the live iOS
  1.1.1 — a real, testable build.
- **No repo change or version bump is needed to start** — build `main` as-is (it's fine that it reports
  1.1.1; a closed-test build's marketing version is immaterial). Bumping to 1.2.0 can happen later; the
  clock won't reset when you upload the finished 1.2.0 build to the same closed track.

Net: the closed test runs its 14 days in parallel with us finishing 2.4/2.2/E.1, so Android's gate is
(ideally) already satisfied by the time 1.2.0 is feature-complete.

### To start the closed test ASAP you need
1. **An `.aab`** — run `cd apps/poker-mobile && eas build --profile production --platform android`
   (the production profile already carries the API URL + OAuth env; EAS signs it). *(I can bump the
   version first if you'd rather the closed build already say 1.2.0 — say the word; otherwise build `main`
   as-is now.)*
2. **The Play "App content" declarations completed** — Play gates *any* release rollout (testing tracks
   included) on these, so do them alongside recruiting testers:
   - **Content rating (IARC):** Gambling **No**, Simulated Gambling **None**, Loot Boxes **No**, Contests
     **Infrequent**, target audience **18+** — same honest answers as Apple.
   - **Data safety:** per `docs/release/store-data-safety.md` (account email/username; consent-gated
     PostHog EU **product-interaction analytics**, not shared, not for ads/tracking).
   - **Target audience & content:** 18+ band, not for children, **Families policy: No**.
   - **Ads: No.** **Privacy policy:** `https://app.tpoker.app/privacy.html`.
3. **≥12 testers** — a Google Group or an email list of 12+ real Google accounts (your poker crew is the
   natural pool). They join via the closed-test opt-in link and must stay opted in for the 14 days.
4. **Upload + roll out** to a **Closed testing** track (the first `.aab` for a new app is uploaded via the
   **console**; `eas submit --platform android --latest` can automate later uploads once the track exists).

---

## 3. Version + build numbers

- **Marketing version → `1.2.0`** on both stores (a one-line `app.json` bump I make when we cut the release).
- **Build numbers are hands-off:** iOS `buildNumber` and Android `versionCode` both auto-increment via EAS
  remote versioning (`appVersionSource: "remote"`). Android's first build gets its `versionCode` assigned by
  EAS; `app.json`'s `versionCode` is ignored under remote versioning.
- The closed-test-now build can be 1.1.1 (current `main`) — the **production** Android release will be 1.2.0,
  matching iOS 1.2.0.

---

## 4. Screenshots — regenerate before the 1.2.0 submission

Wave 2 changes screenshotted screens, so the current `store-assets/` sets are stale for 1.2.0:
- **Home** (`06-home`) — 2.5 top-movers row + "You".
- **Results / settlement** (`07-final-count`, `08-cash-summary`) — 2.2 Results Card 2.0.
- Possibly the game-night flow — 2.4.

`store-assets/store-shots.mjs` (Playwright harness) regenerates **all** required sizes in one pass:
iOS **6.7"**, iOS **5.5"**, **iPad-13**, and **play-phone (1080×1920)**. Run it **after** 2.2/2.4/E.1-visual
land and **before** building 1.2.0; then upload the refreshed sets to both consoles. (Note: the closed test
can start on the *old* screenshots — they're only tester-facing; production 1.2.0 gets the fresh set.)

---

## 5. The two tracks (they diverge in timing, converge on 1.2.0)

### iOS 1.2.0 — ships first (fast)
1. Regenerate screenshots (§4). Bump `app.json` → 1.2.0.
2. `eas build --profile production --platform ios` → `eas submit --platform ios --latest`.
3. ASC → new **1.2.0** version → add build → "What's New" → swap in the regenerated 6.7"/5.5"/iPad
   screenshots → **Submit for Review**. (Reviewer notes + age rating carry over — already accurate.)
4. Apple approves → release. **This can happen while Android is still mid-closed-test.**

### Android 1.2.0 — gated on the closed test
1. **(Now)** Start the closed test off `main` to run the 14-day clock (§2).
2. As 2.4/2.2/E.1 land, update the closed track with newer builds (clock keeps running).
3. Once **14 days + ≥12 testers** are satisfied → **apply for production access** (Google reviews it).
4. When granted: bump to 1.2.0 (if not already), build the final `.aab`, upload the 1.2.0 build +
   fresh screenshots, complete the store listing, → **promote to Production**.

### Shared
- **Deploy the backend first** — 2.2/2.4 may add endpoints; merge to `main` (Railway auto-deploys) **before**
  either store build ships, so new API calls resolve.
- Both production builds come from the **same commit / same 1.2.0**.

---

## 6. Owner vs. me

| You (external) | Me (repo) |
|---|---|
| **Start the closed test NOW** (build .aab, upload, recruit 12 testers) | Trigger/guide the `eas build` command; optional version bump |
| Complete Play App-content forms (content rating, data safety, audience, ads, privacy) | Keep `store-data-safety.md` / reviewer copy accurate |
| Recruit + keep 12 testers for 14 days; apply for production access | — |
| First `.aab` console upload; ASC 1.2.0 version + "What's New"; both submits | `app.json` → 1.2.0; **regenerate screenshots** (`store-shots.mjs`) |
| Upload refreshed screenshots to both consoles | — |

---

## 7. Gotchas
- **Android is ~2+ weeks behind iOS by construction** (the 14-day gate). Set expectations: 1.2.0 lands on
  iOS first; Android follows. Same version, different dates — this is normal and unavoidable on a new Play
  account.
- The 14-day clock is **testers-active time, not build time** — updating the build never resets it, so
  starting early with a rough build is pure upside.
- Play **requires** the App-content declarations before rolling out even a closed test — they're a
  prerequisite, not a production-only step.
- Android **push (FCM)** is optional at launch (degrades to the in-app inbox); wire via `eas credentials`
  only if you want push live on Android.
- Nothing is purchasable on either store — **no IAP/billing setup** (see `docs/release/payments-activation.md`
  for the future path).
