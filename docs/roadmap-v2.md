# T Poker — Post-v1.1 Product Roadmap

v1.1 state: guest-first platform with cash games + local tournaments, Velvet Table
design system, social layer (identity, feed, digest, share cards), push foundation,
store-ready assets and guide. Effort: S ≈ a session, M ≈ 2–3 sessions, L ≈ a phase.

## R1 → v1.2 — "Play together" (highest impact)

| Item | Effort | Depends on | Notes |
|------|--------|-----------|-------|
| **Server-side group tournaments** | L | none (local model is the template) | SessionType discriminator per docs/tournament-mode.md; reuse payout calculator (port C# from TS fixtures), BlindLevel rows, conditional SessionScreen UI |
| **Push delivery rollout** | S | user: FCM/APNs creds via `eas credentials` | Code is done; this is credentials + a device QA pass + enabling at launch |
| **Google sign-in verification** | S | user: console/Vercel steps (google-oauth-fix.md) | Backend fix shipped; verify web E2E after external steps |
| **Android internal-track release** | M | user: Play account + service key | Follow store-release.md steps 1–7; assets ready |

## R2 → v1.3 — "Retention"

| Item | Effort | Depends on | Notes |
|------|--------|-----------|-------|
| **Local → cloud game import** | M | account | `importedSessionId` reserved; map LocalGame → Session+guests; surface "Back up your games" banner action |
| **Scheduled weekly-digest push** | M | push rollout; backend job runner decision (recommend a simple `IHostedService` timer over Hangfire — one job, low ops) | Sunday-evening digest push reusing the digest query |
| **Richer share cards** | S | none | Device frames, streak/achievement cards, tournament bracket card |
| **Activity reactions** | M | none | Lightweight 👏/🔥 on feed items — cheap social glue |

## R3 → v1.4+ — "Expansion"

| Item | Effort | Depends on | Notes |
|------|--------|-----------|-------|
| **Leagues / seasons** | L | server tournaments | Points across tournaments, season leaderboards, champion history |
| **iOS release** | M | user: Apple Developer ($99/yr) | Pipeline identical; TestFlight first; needs APNs + iOS OAuth client |
| **Photo avatars** | M | storage decision (S3/Cloudflare R2 on Railway) | Layer over emoji identity, moderation consideration |
| **Multi-currency** | S | none | Engine is integer-cents currency-agnostic; needs symbol preference + formatting |
| **Rebuy windows / add-ons** | S | server tournaments | Formalize the v1 "anytime rebuys" into configured windows |

## Recommended release train

1. **v1.2** = R1. Ships the two things people ask first ("can we all see the
   tournament?" and "why no notifications?") plus the actual Play Store debut.
2. **v1.3** = R2. Retention loop: import → digest push → reactions.
3. **v1.4** = R3 picks based on usage data (leagues if tournaments are hot;
   iOS when the Apple account exists).

**Rule carried forward:** local-first parity — every flagship feature should work
for guests on-device first (tournaments proved the model), then sync up.
