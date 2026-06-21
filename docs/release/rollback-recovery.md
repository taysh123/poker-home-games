# Rollback & Recovery Runbook

> Extracted from the deployment checklist into a standalone runbook. **No deploy has happened (held).** This is
> the recovery plan for the eventual cutover. Principle: every V2 change is **additive or flag-gated**, so the
> fastest, safest rollback is almost always a flag flip or a `git revert` of the merge — not a destructive reset.

## Pre-cutover (create the safety net FIRST)
- [ ] Tag `main` at the pre-merge SHA: `git tag pre-v2-<date> && git push origin pre-v2-<date>` (rollback target).
- [ ] Create a backup branch: `git branch backup/pre-v2-<date> main && git push origin backup/pre-v2-<date>`.
- [ ] Confirm remote = source of truth (the local checkout can lag — verify on GitHub).
- [ ] Snapshot the DB (Railway PostgreSQL backup) **before** running any merge-time migration.
- [ ] Record the current Vercel production deployment id + the Railway image/deploy id (the redeploy targets).

## Tier 1 — flag kill-switch (no redeploy of code; fastest)
Most V2 risk is behind feature flags. To neutralize a feature without reverting code:
- [ ] Ensure production sets **no** `EXPO_PUBLIC_APP_VARIANT=beta` → `PROD_FLAGS` keep `content`/`mastery`/
      `coach`/`paywall`/etc. **OFF**. A web redeploy with the corrected env disables the surfaces.
- [ ] Billing/AI providers fall back to **mock** by config: unset/!="direct" `BillingSettings:Provider` and
      !="vendor" `CoachAiSettings:Provider` → no real purchases/AI. (Server env change + restart.)
- [ ] These are reversible config changes, not code rollbacks.

## Tier 2 — revert the merge (code rollback; additive changes revert cleanly)
- [ ] Web/git: `git revert -m 1 <merge-commit>` on `main` → Vercel auto-redeploys the reverted build. Because V2
      is additive/flag-gated, the revert is conflict-free for the app surfaces.
- [ ] Backend: redeploy the previous Railway image (recorded above) **or** let the reverted commit rebuild.
- [ ] If only one area is bad, prefer a targeted `git revert <commit>` of that PR's commit over reverting everything.

## Tier 3 — full restore (last resort)
- [ ] Reset `main` to the `pre-v2-<date>` tag (force-push with team agreement) — only if revert is insufficient.
- [ ] Restore the DB from the pre-migration snapshot **only** if a migration must be undone (see below).

## Database considerations (the one non-trivial case)
- V2 migrations are **additive** (new tables/columns/indexes: Subscriptions, CreditBalance, CreditLedgerEntry,
  Notifications, Achievements, etc.). Additive migrations are **safe to leave in place** after a code revert —
  the old code simply ignores the new tables. **Prefer NOT to roll back additive migrations.**
- A destructive/renaming migration is the only case needing a DB restore. Before cutover, **(verify)** no
  pending migration drops/renames a production column; if one does, take the snapshot immediately before and
  treat its rollback as a DB-restore operation, not a code revert.
- `db.Database.Migrate()` runs deferred at `ApplicationStarted` — a failed migration logs and does **not** block
  `/health`; the previous schema keeps serving.

## Partial / commercial rollback
- **Disable billing:** set `BillingSettings:Provider` away from `direct` (→ mock); flip client active provider
  back to `mock`. No purchase can succeed.
- **Disable AI:** set `CoachAiSettings:Provider` away from `vendor` (→ mock); flip `COACH_CONFIG.provider="mock"`.
- **Pull the paywall:** flip the `paywall` flag OFF (Tier 1).

## Verify after any rollback
- [ ] Web loads at the production domain; login/register works; an invite deep link resolves.
- [ ] API `/health` 200; an authed endpoint 200; auth + rate-limiter active.
- [ ] With flags OFF, no V2 content/coach/paywall surfaces are reachable (functional parity with pre-v2).
- [ ] No real purchase/AI path is live (providers on mock).
- [ ] Error rates / logs back to baseline (watch the CORS `LogCritical` + migration logs on boot).

## What is verifiable here vs external
- **Verifiable in-repo:** revert mechanics, flag/config fallbacks, migration additivity.
- **EXTERNAL (dashboards):** the exact Vercel/Railway redeploy + DB-restore steps and ids must be confirmed
  against the live dashboards at cutover — **(verify)**, do not assume.
