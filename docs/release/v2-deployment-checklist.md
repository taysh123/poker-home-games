# V2 Deployment Checklist

> **Reference only — no deploy is performed in this program (Decision 1).** Walk this at the eventual cutover.
> Sourced from `CLAUDE.md` (Deployment section); items marked **(verify)** must be confirmed against the live
> Vercel/Railway dashboards before merge — do not assume.

## Pre-cutover
- [ ] Create rollback target: tag `main` (e.g. `pre-v2-<date>`) + a backup branch (verify remote = source of truth).
- [ ] Confirm final gates green at the merge SHA: `tsc`, `jest`, `expo export -p web`.
- [ ] Review `prod-visible-changes.md` (the live app's appearance will change).
- [ ] Confirm the feature-flag matrix: production env sets no `EXPO_PUBLIC_APP_VARIANT=beta` → all V2 flags OFF.

## Before flipping the `paywall` flag (store IAP compliance — gated)
- [ ] Terms of Service + Privacy Policy links rendered **on the PaywallScreen** (Privacy URL exists; Terms page may need authoring). Apple/Play require functional links on the purchase screen.
- [ ] "Cancel anytime" + renewal terms shown near the CTA (present in fine print today — surface it).
- [ ] Real billing provider wired behind `IBillingProvider` (today `mockBillingProvider` always succeeds; `restore()` is a no-op).
- [ ] Localized store pricing (replace hard-coded `$11.99`/`$79.99` with SDK-provided prices).
- [ ] Every `PREMIUM_FEATURES` benefit either genuinely live or still flagged `comingSoon` (no charging for unshipped benefits). See `docs/design-audit.md`.

## Web → Vercel
- [ ] Root Directory = `apps/poker-mobile` (so `apps/poker-mobile/vercel.json` is the active config; a repo-root one is ignored).
- [ ] Build command = `cd apps/poker-mobile && npx expo export -p web`; Output dir = `apps/poker-mobile/dist`.
- [ ] SPA rewrite present (`/(.*) → /index.html`) so `/join/group/:token` + `/join/session/:token` resolve.
- [ ] Env: `EXPO_PUBLIC_API_URL` = production API URL; `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` set.
- [ ] Production domain = `poker-home-games-three.vercel.app` (NOT `t-poker.vercel.app`); privacy at `/privacy.html`.
- [ ] `main` auto-deploys → merging triggers the production web build. **(verify)** dashboard build settings unchanged.

## Backend → Railway
- [ ] Repo-root `Dockerfile` is the build path (Nixpacks auto-detect fails on the monorepo).
- [ ] Env (`__` nested keys): `ASPNETCORE_ENVIRONMENT=Production`, `ConnectionStrings__DefaultConnection`,
      `JwtSettings__SecretKey` (≥64 chars), `JwtSettings__Issuer`, `JwtSettings__Audience`,
      `GoogleSettings__ClientIds__0`, `AllowedOrigins__0=https://poker-home-games-three.vercel.app`,
      `AppSettings__WebBaseUrl=https://poker-home-games-three.vercel.app`.
- [ ] DB migrations applied (`dotnet ef database update`) — **(verify)** no pending V2 migrations unaccounted for.
- [ ] CORS allow-list includes the Vercel domain (UseCors before exception middleware).

## Post-deploy smoke
- [ ] Web app loads at the production domain; login/register works; an invite deep link resolves.
- [ ] API health: an authed endpoint returns 200; rate-limiter + auth middleware active.
- [ ] Spot-check: with flags OFF, no V2 content/coach/quiz/pack surfaces are reachable (functional parity).
- [ ] Confirm prod-visible visual changes render as intended (per the ledger).

## Rollback
- [ ] Web: redeploy the previous Vercel build (or revert the merge commit → auto-redeploy).
- [ ] Backend: redeploy previous Railway image / revert; restore DB from backup if a migration must be undone.
- [ ] Git: `git revert <merge-commit>` (additive/flag-gated changes revert cleanly) or reset `main` to the pre-v2 tag.
