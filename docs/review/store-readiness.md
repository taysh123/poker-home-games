# App Store / Play Store Release Readiness

First-class review track (Phase D2). Originally read-only; updated after the commercial phase. Verdict: **code +
config are submission-ready**. The former code-blocker — a **Terms of Service URL** — is now **resolved**: a
counsel-owned DRAFT `terms.html` exists and is linked on the paywall + profile (counsel must finalize the copy
before charging). Everything else outstanding is **external setup** (store accounts, signing, service-account
key) or gated on real billing.

## Config (READY)
`app.json`: name "T Poker", version 1.1.0, iOS `com.tpoker.app` + Android `com.tpoker.app`, scheme `tpoker`,
icons/splash/adaptive-icon present, `userInterfaceStyle: dark`, `supportsTablet`. Plugins: web-browser,
secure-store, font, notifications, sqlite. `eas.json`: dev/preview/beta/production profiles, iOS submit
(`appleTeamId`, `ascAppId`), Android submit (internal track), remote build-number auto-increment. No missing
required fields.

## iOS (READY pending external)
Bundle id + versioning ✅; `ITSAppUsesNonExemptEncryption: false` ✅; **no special Info.plist permission strings
needed** (no camera/location/mic — `coachScreenshot` is OFF) ✅; Expo 54 auto-generates the privacy manifest, no
privacy-sensitive APIs detected ✅; ATT not required (no tracking SDK) ✅; live Privacy URL ✅; in-app account
deletion ✅; 18+/responsible-play disclosure on Login + Profile ✅. External: Apple Developer enrollment +
`eas credentials` signing.

## Android (READY pending external)
Package + versionCode ✅; Expo 54 → target API 34 ✅; adaptive icon + edge-to-edge ✅; verified deep links
(`/join`) ✅; minimal permissions (INTERNET, push) ✅; Data-Safety inputs documented (`docs/data-safety.md`) ✅.
External: Play Console account + service-account JSON (`play-service-account.json`, gitignored).

## Subscriptions / IAP compliance
Paywall built but `paywall` flag OFF + **mock billing**; all 5 premium features `comingSoon` (won't charge for
unshipped); restore button present; auto-renew disclosure in fine print; **Privacy + Terms links now on the
paywall** (Terms is a counsel-owned DRAFT — `terms.html`). **Remaining (external, not code):** counsel-final
Terms copy, the real billing SDK + accounts/keys + products, and localized pricing (see
`commercial/billing-architecture.md` + `release/commercial-readiness.md`).

## Privacy (READY)
Live policy (`/privacy.html`), discloses account data + guest-on-device-only + deletion (in-app + email) + no
third-party sharing + no ads/tracking + 18+ + responsible-play. Play Data-Safety form inputs documented.

## Screenshots / metadata (READY)
`store-assets/`: 1024 + 512 icons, 1024×500 feature graphic, phone screenshots at Play 1080×1920 + iOS 6.7"/5.5",
iPad set. Generated from the production web bundle; listing copy + reviewer note in `docs/store-release.md`.

## Age rating / category (READY — positioning matters)
Position as **Lifestyle / Utilities, NOT Casino**. It is a **scorekeeping tool — no wagering, chips, odds, or
real money**. Answer "No" to simulated gambling. Reviewer note (in `docs/store-release.md`) states this plainly;
18+ + responsible-play disclosures are in every legal surface. This positioning is essential to avoid rejection.

## Onboarding / paywall (compliant)
Onboarding doesn't wall content (guest play works; sign-in is contextual). Paywall is user-initiated, honest
pricing, `comingSoon` labels — no dark patterns.

## Outstanding
**Code-blocking (1):** Terms of Service page + paywall link (only required once `paywall` goes live).
**External (you):** Apple ($99/yr) + Play ($25) accounts; `eas credentials` (iOS) + Play service-account JSON;
production builds (`eas build`) + device test; submit. Optional-for-launch: iOS/Android Google OAuth clients,
push credentials (in-app inbox degrades gracefully without).

**Bottom line: engineering-ready; execution-limited by external store setup + a Terms page, not by code.**
