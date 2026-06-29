# Web / App Security Headers (Phase E)

> **Status: implemented (additive, safe).** A `SecurityHeadersMiddleware` adds defensive HTTP headers to every
> API response. Belt-and-suspenders with Railway's TLS edge; no response body/status change. The policy is a
> pure, unit-tested function so it can't silently regress.

## What's added
| Header | Value | Why |
|--------|-------|-----|
| `X-Content-Type-Options` | `nosniff` | Stop MIME sniffing |
| `X-Frame-Options` | `DENY` (+ CSP `frame-ancestors 'none'`) | **Clickjacking** — refuse framing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Lock down powerful APIs |
| `Content-Security-Policy-Report-Only` | `default-src 'self'; frame-ancestors 'none'` | **Report-only first** — observe before enforcing, so the Vercel SPA isn't broken |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS pinning — **production only** |

## Design
- `SecurityHeaderPolicy.Headers(isProduction)` (pure, `PokerApp.Application/Common`) returns the header set —
  unit-tested in `PokerApp.Tests/SecurityHeadersTests.cs` (core headers present; CSP report-only not enforcing;
  HSTS prod-only).
- `SecurityHeadersMiddleware` (`PokerApp.API/Middleware`) applies them; wired early in `Program.cs` (before
  CORS) so they ride on all responses incl. errors.

## Deferred / external (documented, with reasons)
- **Strict (enforcing) CSP** — needs the SPA's exact script/style/connect sources tuned from the report-only
  reports; flip `…-Report-Only` → `Content-Security-Policy` once clean (no app-code change beyond the policy).
- **Redis distributed rate-limit** — current limiter is per-instance; needs Redis (infra) at multi-instance.
- **Anti-bot / scraping / WAF / DDoS** — edge concern (Vercel Firewall / Cloudflare) — external.
- **CSRF** — low-risk here (JWT bearer in `Authorization`, not cookies); webhooks already signature-verified.
- **HTTPS redirect** — intentionally omitted (Railway terminates TLS at the edge; in-app redirect risks loops /
  XFF spoofing — see `security-abuse.md`).

## Verdict
Closes the main standing web-security gap (headers) safely + additively. The rest are infra/edge items tracked
as external dependencies in the final report.
