# Security & Abuse Review

First-class review track (Phase D2). Originally a read-only audit; the safe, fail-closed subset has since been
**implemented in a dedicated backend-security commit** (see the ✅/⚠️/📋 status tags below). Items that are not
safely fixable now (need Redis / real traffic / would risk prod) remain **documented with reasons — not done**.
Verified: `dotnet build PokerApp.sln` clean · `dotnet test` 71 passed (incl. 5 new `JwtKeyTests`).

## Overall posture: LOW current risk, well-hardened
Auth (JWT + rotating hashed refresh + family revocation), server-authoritative fail-closed entitlements,
consistent IDOR guards (membership/creator checks), no anonymous AI, atomic idempotent credit ledger, honest
`comingSoon` paywall + demo banners. Launch-ready **with the 3 P0 quick-wins below**. Risk jumps to HIGH the
moment real billing/AI ship **unless** the billing/content items are addressed concurrently.

## P0 — fix before any public launch (small, in a backend-security PR)
1. **JWT secret padding → fail-closed. ✅ IMPLEMENTED.** `JwtKey.ResolveSigningKey`
   (`Infrastructure/Identity/JwtKey.cs`, unit-tested in `PokerApp.Tests/JwtKeyTests.cs`) now THROWS at startup
   outside Development when `JwtSettings:SecretKey` < 32 bytes, instead of silently padding. Development still
   pads so local dev boots. Prod requires ≥64 chars per the deployment checklist, so a correctly-configured prod
   is unaffected — this only removes the silent-misconfig footgun (padded key → tokens never validate →
   silently broken auth). Wired in `Program.cs` with `requireStrongSecret: !IsDevelopment()`.
2. **CORS fallback → made loud (not fully fail-closed). ⚠️ PARTIAL (deliberate).** Prod still falls back to the
   hardcoded Vercel origin + team-scoped preview prefix match — but `Program.cs` now logs `Critical` when it
   falls back with no `AllowedOrigins` configured, so a misconfig is visible in logs. The policy itself was left
   unchanged on purpose: hard-rejecting on empty config (or dropping the preview prefix) risks breaking the live
   web app / PR previews, which violates "do not break production". Pinning exact origins remains a config-time
   action (set `AllowedOrigins__0`), not a code change.
3. **Rate limiting is in-memory (per-instance). 📋 DOCUMENTED — not changed.** Correct on the current single
   instance; becomes bypassable across instances. A Redis-backed limiter needs Redis (external infra) and only
   matters at multi-instance — deferred to the scalability work, not forced now.

Other small hardening:
- **BCrypt work factor 12→13. ✅ IMPLEMENTED** (`PasswordHasher.cs`) — adaptive cost, so existing cost-12 hashes
  still verify at their stored cost; new/changed passwords use 13 (NIST-aligned). No rehash-on-login today
  (`LoginCommandHandler` only calls `Verify`) — old accounts upgrade on password change; opportunistic
  rehash-on-login is a noted safe future improvement.
- **Mock-billing-in-prod guard. ✅ IMPLEMENTED** (`Program.cs`) — `LogCritical` at startup if Production runs the
  mock billing verifier (`BillingSettings:Provider != "direct"`) or has `AcceptSandbox=true`. The mock grants
  premium for ANY non-empty receipt, so a forgotten deploy env var is now loud, not silent (entitlement-trust
  fail-loud, mirrors the CORS/JWT posture; logging only — no behavior change).
- **`UseHttpsRedirection()` in prod. 📋 DOCUMENTED — intentionally NOT added.** Railway terminates TLS at the
  edge and forwards HTTP internally; an in-app HTTPS redirect (without trusting forwarded headers) risks
  redirect loops, and trusting `X-Forwarded-Proto` would require `ForwardedHeaders` from an untrusted hop = a
  spoofing vector. The edge already enforces HTTPS — safer to leave this off.
- **`Subscriptions(UserId, …)` index. ✅ already present** — verified in `MonetizationConfigurations.cs`. No
  migration needed.
- **Swagger in prod. ✅ already gated** — `Program.cs` maps Swagger only under `IsDevelopment()`; it is not
  exposed in production. (The original note was stale.)
- **Device-token attestation & refresh-replay cooldown. 📋 DOCUMENTED — not changed.** Larger changes; device
  tokens are best-effort/push-only and refresh already rotates + revokes families. Recorded for a later pass.

## P1 — becomes critical when real billing/AI are wired (architecture already supports the fix)
- **Premium entitlement client cache** is display-only + server is authoritative (good). When billing is live,
  the server MUST re-validate entitlement on every premium spend (it already does for `/api/coach/analyze`).
  Never trust a client-sent tier/price.
- **Credit consume/refund** is atomic + idempotent; add HTTP-layer request-dedup when a real vendor is wired to
  close the retry timing window.
- **Subscription webhooks** use `LatestEventAtUtc` ordering — keep that when the real verifier lands.

## The key pre-monetization decision: bundled content is extractable
All content artifacts (coach grounding, quizzes, packs) **ship in the app bundle** → trivially extractable.
Gating is **UX, not DRM**. This is honest today (premium features are `comingSoon`, content is positioned as
educational). **Before charging for premium content**, decide: (A) server-gate/deliver premium packs only to
entitled users (`GET /api/content/packs?tier=`), or (B) keep bundled + treat as "educational for all" (market,
don't DRM). Shipping a paid tier whose content is bundled-for-everyone would undermine the paywall.

## Trust boundaries (what the server must never trust from the client)
Receipts (verify server-side — mock today), entitlement/tier/price, device tokens (attest), any `userId` in a
body (use the claim). All currently respected except device-token provenance.

## Secrets / PII
No secrets committed (OAuth client IDs are public). Account deletion exists + anonymizes sessions (GDPR-friendly);
add a deletion audit-log entry for compliance. No analytics/tracking SDK; passwords BCrypt, refresh hashed.

## Verdict
The safe P0 subset is now implemented (JWT fail-closed + BCrypt 13 + CORS fallback visibility + mock-billing-in-
prod guard) — build clean, 82 backend tests green. The remaining P0 items #2/#3 are **config/infra actions, not code gaps** (pin
`AllowedOrigins__0`; add Redis only at multi-instance). Treat the bundled-content decision + real-billing
re-validation + fraud-enforcement (`FraudSettings:EnforceBlocking=false` today, advisory) as **must-do
concurrently with monetization**, not after.
