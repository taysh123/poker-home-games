# Q2 master plan — pillars wave, security folded in

**Status:** awaiting owner approval. Nothing here is built.
**Written:** 2026-08-05, on complete ground — all 10 app-audit sections and all 6 security
dimensions closed (PR #79), plus a dedicated 4-pillar code-grounding pass
(`2026-08-05-q2-grounding-notes.md`).

**Supersedes** the Q2 block (Q2.1–Q2.7) of `2026-07-27-product-quality-master-plan.md`. That
brief was written before the audit and before anyone counted the code; grounding found it wrong,
stale, or already-done in ~30 places. Its Q1 and Q3 blocks stand unchanged.

**Sequencing shape (owner-approved):** Approach C — a short live-defect block first, then each
pillar **opens with its own security prerequisite as slice 1**, so security is structural rather
than bolted on. Pillar order: **bankroll → premium → stats → tour.**

**Honest size:** ~43 slice-days ≈ **8–9 weeks** at a sustainable pace. The brief said "~2 weeks."
It was never 2 weeks; that number predates counting. Owner accepted the longer wave deliberately:
*"I want a full, polished product before the build and release; I'd rather ship complete than
rush to the store."*

---

## 0. Standing rules for every slice in this wave

1. Slices are **1–3 days and independently shippable** — one PR each, small enough to review, so
   a quota interruption never strands much.
2. **TDD, revert-tested.** Every fix gets a test that goes red when the fix is reverted.
3. **Pin literals, not symbols.** A ratchet's measurement is as load-bearing as its threshold.
4. **Fleet at HIGH effort** before each PR. Security-shaped slices get a security-aware fleet.
5. **Verify raw fleet output** — never trust an "N/N returned" summary. 3 of 12 agents in the
   security fleet returned bogus placeholders after doing real work; 3 of 4 in the first
   grounding attempt died silently.
6. **Ship invariants unchanged**: nothing becomes purchasable; every premium surface stays
   honestly "coming soon"; the store track is never blocked.
7. **Screenshots are regenerated ONCE**, at the end (§7) — not per-slice.

---

## 1. Tier 0 — live-defect block (~5.5 days)

These are live on a shipped App Store build and **have no pillar to ride with**. They ship first,
as small independent PRs.

| # | Slice | Days | Audit ref | 📸 |
|---|---|---|---|---|
| T0.1 | **AddPlayer consent + SearchUsers scoping + self-removal** | 2 | HIGH #1 | no |
| T0.2 | **EndSession concurrency guard** | 1 | HIGH #3 | no |
| T0.3 | **EndSession achievement try/catch** | 0.5 | HIGH #7 | no |
| T0.4 | **axios CVE bump** | 0.5 | HIGH #8 | no |
| T0.5 | **HandRecord GUID scrub + privacy-policy rewrite** | 1 | HIGH #4 + #5 | no |
| T0.6 | **Analytics opt-out retroactivity** | 0.5 | HIGH #6 | no |

### T0.1 — AddPlayer consent (owner decision: group-scope + self-removal)

Today any authenticated user can add **any** registered user to a session's ledger — no shared
group, discoverable via the unscoped `SearchUsersQuery` — then generate real settlement debts
against them, with **no way for the victim to remove their own seat** (and once Active,
registered players can't be removed at all).

- Add-by-`userId` is **restricted to users sharing a group** with the caller.
- `SearchUsersQuery` is **group-scoped too** — it is the discovery vector; fixing one and leaving
  the other fixes nothing.
- **Self-removal always works**, regardless of session status. *This is the load-bearing
  property* — it is the recourse for the residual case (a group member adding another member to
  a session they didn't attend). Make it airtight and pinned.
- **Guests (add-by-name) keep working unchanged** — that's the "they're sitting right here" fast
  path and it has no victim.

**Tests (all revert-tested):** a non-group-member cannot be added; a user can always remove their
own seat *including* during an Active session; guest add-by-name is unaffected.

### T0.2 — EndSession concurrency guard

`Session` has no concurrency token anywhere (repo-wide grep: zero `IsConcurrencyToken`/
`IsRowVersion`). Two concurrent "End Game & Settle" submits both pass the `Status == Active`
guard and each insert a full set of `CashOut` rows; settlement/balance queries sum **all** rows
with no dedupe, so a lost race **doubles a player's counted cash-out**. Same TOCTOU class PR #78
fixed for `RemovePlayer`.

Add a rowversion/concurrency token so the losing writer gets `DbUpdateConcurrencyException` → 409;
*or* make `FinalStacks` idempotent per session (reject if any `CashOut` already exists). Prefer
the concurrency token — it generalises to the `JoinSessionByToken` race (MEDIUM, same class).

### T0.3 — EndSession achievement try/catch

`session.End()` commits, then `achievementEvaluator.EvaluateAsync` runs **unguarded** — while the
notification block three lines below it is explicitly wrapped ("non-critical"). A unique-constraint
race on `(UserId, AchievementKey)` throws `DbUpdateException`, unmapped → **bare 500 on a request
whose core effect already succeeded.** Identical class to the two defects PRs #74/#78 fixed. Wrap
it in the same pattern already used one line below.

### T0.4 — axios CVE bump

`^1.16.1` → the advisory range is `>=1.0.0 <1.18.0`, one High (GHSA-gcfj-64vw-6mp9, proxy
inheritance after interceptor config cloning). This is the **single shared HTTP client for the
whole app including the 401-refresh interceptor**. The fix is already inside the existing semver
range — regenerate the lockfile, then `npx tsc --noEmit` + `npx jest`.

### T0.5 — HandRecord GUID scrub + policy rewrite (owner decision: fix the GUID, correct the copy)

Two halves, deliberately split by what's defensible:

**Fix in code — the raw account GUID.** `HandRecord.CreatedByUserId` is a bare `Guid` with no
modelled FK (so it's invisible to the deletion ratchet), never touched by `DeleteAccountCommandHandler`,
and **served verbatim to every session participant** by `GetSessionHandHistoryQueryHandler`. Zero
product value to anyone. Null it on deletion **and stop serving it**.
*Tests, both revert-tested:* the column is nulled on deletion, **and** the hand-history API
response never carries it. Also extend the FK-inventory ratchet to flag `*UserId`-named
`Guid`/`Guid?` properties with no modelled FK, so `Session.CreatorId` and `ActivityLog.ActorUserId`
(same shape, also unaddressed) can't keep escaping review.

**Fix in copy — the display names.** Names survive in `ActivityLog.ActorName`/`Description`,
`HandRecord.WinnerName`, and other users' notification bodies. **Deliberate decision (owner,
2026-08-05): keep them.** Reasoning, recorded so nobody later "fixes" it: *"Dan" in Dana's record
of their game night is Dana's data, not Dan's — scrubbing it to "Unknown" deletes Dana's memory of
her own session.* Instead rewrite the policy to state the real scope.

> **Draft policy wording — owner must approve the exact text before it ships.** Replacing
> `privacy.html`'s "permanently removes your account and all associated personal data … from our
> servers, immediately":
>
> *"Deleting your account permanently removes your profile, your login credentials, your
> settlement records, your group memberships, your notifications and your device tokens. Because
> T Poker records shared games, your display name may remain visible in other players' history of
> games you played together — in their group activity feed and in hand records you created. Those
> entries belong to their record of a shared game night."*
>
> Must also be checked for consistency against the App Store / Play privacy declarations before
> shipping. This is a legal-surface claim: it has to be both true and defensible.

### T0.6 — Analytics opt-out retroactivity

A user who opens the app **already opted out** never constructs a PostHog client, so `dispatch()`
returns early without advancing `drained`. Opting back in constructs the client for the first
time and its drain loop sends **everything buffered since launch — including the opted-out
window**. Fix: on `setAnalyticsOptOut(true)`, advance `drained` to `buffer.length` immediately so
nothing generated after that point is ever eligible. Test the exact untested precondition
(already-opted-out at launch, client never started) — the existing test pre-creates the client via
`grantAnalyticsConsent()` and takes a different, non-leaking path.

---

## 2. Pillar 1 — Bankroll (~11 days) · **now a headline FREE pillar**

**Owner decision (2026-08-05), superseding decision 2 of 2026-07-28:** `advanced_bankroll` is
**dropped from `PREMIUM_FEATURES` entirely.** Bankroll is free, forever, and that becomes a
**loud marketing asset, not an apology.**

Reasoning, recorded: the original decision assumed the split "takes nothing a free user has today
(the screen was never live)" — **false**, `BETA_FLAGS.bankroll = true`, so every beta tester sees
the full variance section free right now. And more fundamentally: the other three premium benefits
each carry a **real marginal cost** (authored lesson content, per-call AI spend, sync
infrastructure). Bankroll analytics is **zero-marginal-cost client-side arithmetic on data the
user typed in themselves.** Charging for that is a manufactured hook.

**Consequence for craft:** bankroll is an **acquisition hook**, not a lesser tier. The calendar
and heatmap must feel premium-quality *because* they're free.

*(Multi-bankroll accounts — the dormant `BankrollAccount` shape — is recorded as a possible later
premium addition if the audience ever shifts toward serious grinders. It is structurally more, so
it would be honest. Not Q2.)*

| # | Slice | Days | Depends on | 📸 |
|---|---|---|---|---|
| B1 | **Account-scope the bankroll store** (persona/coach precedent) | 2 | none — **blocks B9** | no |
| B2 | Log-form honesty + prod-safe date input | 1.5 | none | no |
| B3 | Pure calendar logic (day/month buckets, heatmap bins, to-bound fix) | 1 | none | no |
| B4 | 🎨 **ui-ux-pro-max taste directions** — calendar + heatmap | 0.5 | B3 | no |
| B5 | Month calendar view + monthly P&L strip | 2.5 | B3, B4 | yes |
| B6 | Year heatmap | 1 | B5 | yes |
| B7 | Date-range + tags filter UI | 1 | B3 | yes |
| B8 | Drop `advanced_bankroll` from `PREMIUM_FEATURES` + pin edits | 0.5 | none | no |
| B9 | **Flip the flag** | 0.5 | B1, B2, B8 (ideally B5) | yes |

### B1 — Account-scope the store (PREREQUISITE; blocks the flag flip)

Today: one device-global key `tpoker.bankroll.v1`, never cleared on logout, and `TrackScreen`
renders Bankroll **for guests with no auth gate** — so guest-logged sessions merge into whichever
account signs in next.

**Follow the `personaStore` precedent exactly** (its own header cites `coachStore` as a second
precedent): an account-keyed `byAccount` map (`guest` / `acct:<userId>`), quarantine path
preserved, plus a `claimGuestBankroll()` mirroring the shipped pure function `claimGuestPersona()`.

- **The load-bearing safety property:** guest data is claimed **only if the account has none of
  its own** — this is what stops a returning user's real data being overwritten. **Pin it,
  revert-tested:** an account *with* existing bankroll data does **not** get guest data claimed
  over it.
- On logout you see the guest scope again; the account's bankroll is retained, just not shown.
- **Recorded decision:** existing beta data has no owner attribution, so it lands in the guest
  scope and is claimed by the first sign-in. That is the behaviour testers would expect — noted
  here so it is a decision on record, not a surprise a tester reports.

### B2 — Log-form honesty + prod-safe date input

- **`LogSessionScreen.tsx:81` gates the native date picker on `isFeatureEnabled('polish')`, and
  `PROD_FLAGS.polish = false`.** In a real prod build the date field degrades to a raw text input
  demanding a typed `YYYY-MM-DD`. **Every dev and beta tester has only ever seen the picker.**
  Decouple the picker from `polish` (bankroll-scoped, small) rather than flipping `polish` (much
  larger blast radius). *Engineering call, made here; say so if you disagree.*
- Real `rebuyCount`/`addOnCount` inputs replacing the `0-or-1` fabrication.
- Surface `notes`/`tags` read-only in the history row (nothing renders them today).
- **SB/BB stakes inputs are NOT in this slice.** The schema fields exist, but *nothing reads
  them* — shipping the inputs alone repeats the exact write-only-data defect class the audit just
  flagged for `rebuyCount`. They return when a read surface (bb/100, per-stake grouping) exists.

### B3 — Pure calendar logic

New: `dayBuckets`, `monthBuckets`, `heatmapLevels`, built on the already-tested `localDayKey`/
`localMonthKey` (the UTC shortcut is banned repo-wide by `dayKeyBan.test.ts`). **Extract** the
duplicate month-net logic out of `EngagementContext.tsx:92-100` so there is one implementation.
**Fix the to-bound:** `filterSessions` string-compares a noon-anchored UTC `startedAt` against the
raw `to` bound, so a bare day key silently excludes that entire day. Materialise range ends as
end-of-day instants; add the test.

### B4 🎨 — Taste directions (ui-ux-pro-max)

2–3 directions for the calendar + heatmap, **before any building.** Brief: this is a *free*
headline pillar and an acquisition hook — it must feel premium-quality. Copy the house chart
pattern from `BankrollLineChart` (onLayout width, static SVG, `accessibilityRole="image"`,
composed label, reduced-motion safe by construction).

### B5–B7 — The visual core

Watch `a11yRoleRatchet.test.ts:165` — `BankrollScreen` is capped at 2 unroled touchables and a
`.map()` of day cells counts as one call site: day cells need roles, or the ceiling needs an
explicit reviewed raise. Also address the **unpaginated** session history before a calendar
invites year-scale datasets. B7 is genuinely presentational — all six filter fields and
`filterSessions` already exist and are pinned.

### B9 — Flip the flag

One line in `config/features.ts` + one `expectedOn` entry. **Track already leads with Bankroll**
(`TrackScreen.tsx:39-48`) so nothing is needed there — the brief's line item is already done.
This is deliberately **last**: it is what turns the storage leak, the prod date-input regression,
and the free variance section into live-user facts. Capture belongs to §7, not here.

**Deferred out of Q2:** prefill "Log to Bankroll" from a finished local game — **blocked** on a
product decision (`LocalPlayer` is `{id, name}`; a local game has no notion of which seat is the
logged-in user). See §8.

---

## 3. Pillar 2 — Premium preview (~10 days)

**Grounding's central correction: content quality is not the binding constraint — distribution
is.** The preview has exactly **one** prod entry point (`ProfileScreen`, authed-only). Guests —
the entire free-first funnel — cannot reach it at all, and their locked lesson rows are **dead
taps** (`onPress = undefined`). Building a beautiful page nobody can open is wasted work.

| # | Slice | Days | Depends on | 📸 |
|---|---|---|---|---|
| P1 | **Entitlement trust hardening** | 2 | none — **blocks P3–P6** | no |
| P2 | **RedeemTopUp receipt verification** | 1 | none | no |
| P3 | Preview reachability + honest locked rows + render pin | 1.5 | P1 | yes |
| P4 | 🎨 **ui-ux-pro-max taste directions** — premium preview | 0.5 | P3 | no |
| P5 | Registry wiring: one copy source, cooldown seam, typed param | 2 | P3 | maybe |
| P6 | The product page itself | 3 | P4, P5 | new screen |

### P1 — Entitlement trust hardening (PREREQUISITE — audit HIGH #9)

The strongest finding in the whole audit: **two independent passes, two days apart, with no
shared memory, converged on the same line.** Grounding then found it is *worse* than audited.

- `entitlementResolve.ts:25-37` falls back to an **unsigned locally-cached `isPremium`** whenever
  the server call fails for *any* reason — including a missing token or a network blip, both
  routine. `EntitlementsContext.refresh()` sets `server = null` inside a bare `catch {}` for every
  failure, under a comment claiming "fail-closed" — which is self-contradictory, since falling
  back to a locally-writable premium flag *is* failing up.
- The cache stores **no userId, no timestamp, no signature**. On web it is one devtools line.
- **New from grounding:** `PremiumContext.tsx:48-59` loads it in a `useEffect` with **empty
  deps** and never reloads on auth change — so a premium cache written under account A
  **survives logout into account B.**
- **Blast radius (verified, corrected):** `lessonAvailability` returns `'available'` for anything
  when `isPremium`, and the free tier is 3 modules of 28 — so a poisoned cache unlocks **25
  locked modules**, whose full text already ships unencrypted in the bundle.
  *(The audit said "22 of 28"; that counted the workbook's `FreeOrPremium` column, which
  `lessons.ts:41` explicitly overrides. 25 is the number the code produces.)*
- `LessonReaderScreen` does **zero entitlement work** — the only gate is a conditional `onPress`
  in the caller. The 2026-08-03 audit independently flagged this same line as "latent — live the
  moment any new entry point forgets the source-side check."

**Four coupled changes that only make sense together:**
1. `entitlementStore` schema v1→v2 adding `userId` + `cachedAtMs`, migrating through the existing
   quarantine path; `PremiumContext` reloads on auth change instead of `[]` deps.
2. `entitlementResolve` gains a **staleness + scope ceiling**: a cached premium stands only within
   a bounded grace window **and** only for the currently signed-in `userId`. Pure — extends the
   existing `entitlementResolve.test.ts` directly.
3. `LessonReaderScreen` **re-derives its own lock** (`lessonAvailability` + `useEntitlements`),
   fail-closed while loading — the reader stops trusting its caller.
4. `LandingScreen` gets the `isFeatureEnabled('paywall')` self-guard `PaywallScreen` already has,
   and `mockBillingProvider` is gated so it can never persist an entitlement in a non-dev build.

**Revert-test each of the four independently.**

### P2 — RedeemTopUp receipt verification (audit HIGH #2)

`RedeemTopUpCommandHandler` grants AI credits on a **config lookup alone**, keyed by a
client-supplied `PurchaseToken` — nothing ties that token to a real purchase, and any new token
string is a new idempotency key. Inert today only because `TopUpSettings.Enabled` defaults false
everywhere. Call `IBillingVerifier.VerifyAsync` before granting — exactly as
`ValidatePurchaseCommandHandler` already does — using the **store-confirmed transaction id** as
the idempotency key. Add a startup fail-loud check refusing to boot with `Enabled=true` while no
verifier call exists in the redeem path (mirroring the existing prod billing/CORS `LogCritical`
pattern).

### P3 — Reachability + honest locked rows (owner decision, refining decision 5 of 2026-07-28)

> **Decision 5 superseded.** The original approved "locked lesson rows route to the paywall
> preview." Grounding's new fact: guests can't reach the preview at all. **Refined decision
> (2026-08-05): fix the dead taps, give guests an opt-in path only.**
> Reasoning: individual dev account, already took a 2.3.6 metadata rejection, and the store
> README's rule is "education first, nothing reads as a paid poker product." Routing every locked
> row into an upsell puts commercial framing in front of exactly the cohort a reviewer samples —
> with no purchase path anyway.

- Locked rows render as **clearly non-interactive locked items** with the honest "coming soon"
  chip — **not fake buttons**. Dead taps disappear because the affordance disappears.
- **A11y must match:** no `button` role on a non-interactive locked item. (We just spent a whole
  wave fixing exactly that class.)
- A deliberate **"What's in Premium" row on `StudyScreen`** — the existing both-trees precedent —
  is the opt-in path. A curious guest can see what's coming; nobody has it shoved at them.
- **Add the missing render-level pin**: `PaywallScreen`'s flag-OFF branch contains no price
  string and no purchase/restore control, and *does* contain the legal row. Fix
  `legalSurfaces.test.ts` from a raw file-text grep to a branch assertion — today it passes even
  though the flag-OFF branch renders no legal links at all.

### P5 — Registry wiring

`TRIGGER_REGISTRY` is complete and tested with **zero production consumers**, and its own header's
claim that copy "mirrors the current call-site copy" is **false for 4 of 12 ids**. So this is not
mechanical string-hoisting: 3 surfaces are exact matches (behaviour-preserving), **4 need a copy
decision**, and per copy-honesty rule 5 each decided string is a new claim needing its own pin.
Add the missing consumer seam as **one composed updater** (never chained raw writes — the
StudyContext compose rule). Fold in the trivia: type the route param as `TriggerId`, replace the
`` `landing_${plan}` `` template mint with a typed map, declare `purchase_pending`, and correct
the registry's own false header claim.

### P6 — The product page

Pillar-structured sections, honest state labels, free-taste cross-links, the `coach_teaser` card,
and the legal/support row the flag-OFF branch currently lacks.

- **Use live in-app component previews, not bundled store PNGs.** Reusing the store shots costs
  ~1.5–2 MB and creates a permanent staleness contract — a screenshot of a screen that later
  changes becomes a false claim, rule 3's exact failure mode. The real components are already in
  the bundle and are always accurate.
- **Which-lands-first must be derived from config**, not hand-written (the `tierLabel(dataset)`
  discipline).
- `coach_teaser` is **blocked as specified** — see §8.

---

## 4. Pillar 3 — Stats & progress (~10 days)

| # | Slice | Days | Depends on | 📸 |
|---|---|---|---|---|
| S1 | **StudyProgress v3 schema + version-set fix** | 1 | none — **blocks S2–S8** | no |
| S2 | Quiz counts for streak + volume, + copy fix | 1.5 | S1 | no |
| S3 | Spot answers record scenario/position | 1 | S1 | no |
| S4 | XP monotonicity clamp | 1 | none | no |
| S5 | Pure dashboard logic | 1 | S1–S3 | no |
| S6 | 🎨 **ui-ux-pro-max taste directions** — progress dashboard | 0.5 | S5 | no |
| S7 | StudyScreen trendline | 2 | S5, S6 | yes |
| S8 | Training section (Stats + GuestStats) | 2 | S5, S6 | yes |

### S1 — Schema (PREREQUISITE; getting it wrong quarantines users' streaks)

The brief said "per-day `{answered, correct}` — one line in `recordAnswer`." **Wrong twice:**
`dailyCounts` is read as a **number at 8 sites** (so reshaping it is not additive — add a
**parallel** `dailyCorrect?` map instead), and `studyStore.ts:16` hardcodes
`SUPPORTED_VERSIONS = {1,2}` — **bump the version without adding 3 and every v3 file the app
itself writes is quarantined on next load: silent loss of the user's streak.** Version-set edit +
4 test-pin edits are part of this slice.

### S2 — Quiz counts (owner decision, 2026-08-05)

Today the **daily quiz — the headline free feature, the full 1,460-question bank — contributes
nothing** to accuracy, answered, streak or daily goal. A user who does it faithfully every day has
no streak, while `StudyScreen.tsx:100` tells them "Train a spot today to start a streak."

**Decision: quiz counts for streak + active days + study volume. Accuracy stays per-surface**
(Quiz accuracy / Practice accuracy, never blended) — a broad question bank and range-specific spot
drills measure different things, and "am I bad at ranges or just at trivia?" must stay answerable.

- **Non-retroactivity is a guarantee, not a hope.** No per-question history was ever stored, so
  prior days cannot be backfilled: **no existing streak changes**; some users simply start earning
  streaks going forward. **Pin it** — a test proving existing streaks are untouched. *("We
  silently changed a number the user had seen" is a class we keep getting bitten by.)*
- **Fix the copy in the same slice** — the streak-start message must reflect that finishing the
  daily quiz also starts a streak.
- **The `quizFinished` pin is deliberately rewritten, not flipped.** Before/after:

```js
// BEFORE — quizFinished.test.ts:44-49
it('does not touch streak/goal state (quiz answers are not practice reps)', () => {
  const p = recordQuizFinished(emptyProgress(), DAY);
  expect(p.dailyCounts).toEqual({});
  expect(p.totalAnswered).toBe(0);
  expect(p.currentStreak).toBe(0);
});

// AFTER — narrower, pins the new intent rather than flipping signs
it('counts toward streak and volume, but not toward practice accuracy', () => {
  const p = recordQuizFinished(emptyProgress(), DAY);
  expect(p.dailyCounts[DAY]).toBe(1);   // activity: quiz is a study day
  expect(p.currentStreak).toBe(1);      // the retention fix
  expect(p.totalCorrect).toBe(0);       // accuracy stays per-surface — NOT blended
});

it('does not retroactively alter a streak earned before quizzes counted', () => { /* … */ });
```

### S4 — XP monotonicity clamp

Confirmed and **narrowed**: `bankroll` is prod-OFF, so the live prod regression vector is
**deleting a finished local game (−15 XP)**, reachable by every guest. Fix material already
exists — `deleteGame` **tombstones** rather than erases, so a true lifetime count is
reconstructible; `LocalGamesContext` just doesn't expose the raw file. One exposed counter + one
clamp + discriminating tests (the existing `EngagementContext.test.tsx` fixtures are static across
all three tests, so this axis is currently unpinned).

### S7–S8 — The dashboard

- **Sparse data is the DEFAULT week-one view, not an edge case.** Mastery thresholds are
  Proficient 10 attempts/70%, Mastered 20/85%, against free metering of 10 practice/day shared +
  1 quiz/day — several days of perfect attendance for *one* category to reach Proficient, weeks
  for Mastered, and a 30-day inactivity decay that silently regresses categories. Design the
  sparse state first.
- **Placement:** put Training after "Key Numbers" or after "P&L Trend" — **not** adjacent to the
  existing "Streak" section, which is driven by the **server win/loss streak and can be
  negative**. Two identically-named streaks side by side read as one number contradicting
  another; the Q1.4b design already flagged this exact collision.
- **Scope honesty:** `tpoker.study.v1` is device-global and survives logout (same class as the
  bankroll leak). An authed Training panel would show device data beside server data. Either
  account-scope the study store (a migration — see §8) or label it "on this device"
  (`GuestStatsScreen` already uses that precedent).
- **No reusable chart component exists** (`components/` has only `ProgressBar`; `PLBarChart` is
  private and typed on `RecentSessionDto`). The trendline is genuinely new UI.
- **📸 correction:** the `09-stats` shot is captured **as a guest**, so it renders
  `GuestStatsScreen` — a Training section on the authed `StatsScreen` appears in **zero** store
  screenshots. To move a shot you must target `GuestStatsScreen` and/or `StudyScreen`, and the
  harness seeds no study file, so any panel would capture its **zero state** unless the seed is
  part of the slice.

---

## 5. Pillar 4 — App tour (~6 days)

| # | Slice | Days | Depends on | 📸 |
|---|---|---|---|---|
| T1 | **Tour one-shot as a persona field** | 1 | none — **blocks T4** | no |
| T2 | 🎨 **ui-ux-pro-max taste directions** — tour | 0.5 | none | no |
| T3 | Shared explainer content module | 1.5 | T2 | no |
| T4 | Tour screen + both-tree registration + entries | 2 | T1, T3 | no |
| T5 | Honesty test + a11y + store-shots seed | 1 | T4 | no |

### T1 — The one-shot (PREREQUISITE; this is how the tour avoids inheriting a live bug)

The brief's design would inherit the `hasSeenOnboarding` staleness bug **exactly**. That bug is
worse than the audit recorded: the cached value feeds four consumers including *whether the
Onboarding route is registered at all*, and there is a **restart-surviving variant** — a
sign-in-first user never writes the key, so their first logout replays the funnel *forever*.

**Correct pattern, already in-repo:** add `tourSeenAt` to `Persona`, a **write-once**
`markTourSeen()` modelled on `recordPlacement` (enforced *in the store*, not the UI), gated on
**live state** exactly like `showPlacement`. Account-scoped, survives the guest→account claim, and
cannot go stale because `PersonaProvider` owns both the read and the write.

**Do NOT use a `storage.setItemAsync` key.** `utils/storage.ts` routes every `setItemAsync` to
**sessionStorage** on web whenever `_sessionMode` is on — set by any remember-me=false login and
**never reset** — so a storage one-shot can evaporate when the tab closes.

### T3 — Shared content (the brief's "zero duplication" is false)

**Three product explainers already exist**: the marketing site's `HOW_IT_WORKS`, the in-app
`LANDING_SECTIONS` (7 one-idea sections with honesty chips already derived from
`premium/config.ts`), and the funnel's promise step plus the legacy slides. Hand-writing a fourth
copy of the pitch is a copy-drift defect **on arrival** (rule 5: replacement copy inherits none of
the original's review). Extract a platform-neutral shared module and have the tour **read** it.

### T4 — Screen + entries

- Registration in both trees is ~15 minutes (3 mechanical edits). *PersonaQuiz is **not** a screen
  precedent — it's a second route name onto the same component.* The size here is content and
  gating, not routing.
- **Trigger is tour-state alone**, on first arrival at Home — **not** the funnel exit. A first-run
  user who taps "Sign in" on Welcome never runs the funnel, so a seam-based trigger silently
  misses that entire cohort.
- **Entries: `StudyScreen` row (works in both trees) + `ProfileScreen` row (authed).** Profile
  alone is not enough — it is authed-only, and two existing routes are already dead for guests in
  exactly this way.
- **Visual treatment is a taste+size decision** (T2): the only real product screenshots are
  **deliberately excluded from native binaries** (~650KB), so "visual" is not free on native —
  icons/illustration ships now, reversing that exclusion does not.

### T5 — Honesty + a11y + harness

Card 4 ("Track + Premium-coming") copy must be **derived** from `isFeatureEnabled` +
`premium/config.ts`, not hand-written — and needs **its own honesty test**, because
`tierHonesty.test.ts` is a literal allow-list scoped to `features/study/ui` only. `a11yRoleRatchet`
defaults new files to a ceiling of **0** unroled touchables. And `store-shots.mjs` seeds
`hasSeenOnboarding` + a fixed `SEED_PERSONA` — **a tour offer gated on a field absent from that
seed will render over the captured screenshots.** The seed edit is part of this slice.

---

## 6. 🎨 ui-ux-pro-max — the taste gate

**Every visual surface gets 2–3 taste directions before any building.** These are explicit slices
(B4, P4, S6, T2), each gating the build slice behind it:

| Surface | Gate | Brief for the directions |
|---|---|---|
| Bankroll calendar + heatmap | B4 → B5–B7 | A **free** headline pillar and acquisition hook — must feel premium-quality. House SVG chart pattern, reduced-motion safe, day cells need a11y roles. |
| Premium preview page | P4 → P6 | Honest "coming soon" with zero purchase UI. Live component previews, not bundled PNGs. Pillar-structured. |
| Progress dashboard | S6 → S7–S8 | **Sparse data is the default week-one view** — design that state first, not as an apology. Two distinct accuracy tracks, never blended. |
| App tour | T2 → T3–T4 | 4 cards. Native cannot use the real screenshots (~650KB exclusion) — icon/illustration direction vs. reversing that decision is part of the taste call. |

---

## 7. Screenshots — one batch, at the end

Store screenshots are regenerated **once**, as the final pre-1.2.0 step, across everything the
four pillars touched. Constraints that shape it:

- **No bankroll shot exists today.** The set is 10 shots; **Play caps at 8** (01–08) in a
  deliberate study-first order. A bankroll shot either **displaces** one of 01–08 or rides at
  09/10 and is **invisible on Play**. → open question §8.
- **Capture is strictly ordered after B9** — `store-shots.mjs` seeds localStorage but **cannot
  change a compile-time flag**, so no bankroll shot is capturable until the flag flips.
- **`09-stats` is a guest capture** — target `GuestStatsScreen`/`StudyScreen` for training
  surfaces, and add a study-file seed or the panel captures its zero state.
- The harness seed must also cover `tourSeenAt`, or the tour offer renders over other shots.

---

## 8. Open questions for the owner

Nothing below blocks starting Tier 0 or Pillar 1's first slices.

1. **Local-game prefill** (defers B-slice) — a `LocalGame` has no notion of which seat is "me"
   (`LocalPlayer` is `{id, name}`, and the CTA renders for guests). Ask which seat each time, or
   persist a "this is me" marker (schema v5)? *Recommendation: ask-each-time, no schema change.*
   Also note cloud sessions have **no** Log-to-Bankroll path at all today.
2. **`coach_teaser` is unshippable as specified** — `isTriggerEligible` returns `coachEnabled` for
   every coach-surface trigger and `coach` is false in prod, so the card can never render. Add a
   "teaser allowed while the feature is dark" eligibility axis, or move it off the coach surface?
3. **Placement retake** — blocked by a deliberate **write-once anti-farming invariant enforced in
   the store**, not missing UI. Reverse it, meter the retake (then it stops being a fair
   assessment), or ship baseline-only? *Recommendation: baseline-only for Q2.*
4. **Account-scope `tpoker.study.v1`?** Same device-global leak class as bankroll. Scope it (a
   migration, ~1 day, and B1 will have just built the pattern) or label the panel "on this
   device"? *Recommendation: scope it, reusing B1's pattern while it's fresh.*
5. **Mastery** — flip the prod flag to light the already-built engine, or write a parallel
   aggregate into StudyProgress and import `MASTERY_CONFIG` purely?
6. **Screenshot slots** — does a bankroll shot displace one of Play's 01–08, or ride at 09/10 and
   be invisible on Play?
7. **"Which lands first"** needs a committed, publishable order across the three remaining premium
   benefits. Is there one, and is it firm enough to publish? A published order that slips is a new
   honesty liability of exactly the tracked class.
8. **Exact privacy-policy wording** (§T0.5) — approve the draft text before it ships, and confirm
   consistency with the store privacy declarations.

---

## 9. Risks

1. **Long wave, quota-fragile environment.** Mitigated by 1–3 day independently shippable slices
   and per-slice PRs. Three separate fleet actions have already been killed by quota; assume more.
2. **Pin churn is deliberate in three places** (`quizFinished`, `features.test.ts expectedOn`,
   `honesty.test.ts`/`paywallContent.test.ts` for the dropped benefit). Each PR must show the pin
   diff explicitly — extended or deliberately rewritten, never weakened.
3. **B9 is a one-way door for the storage leak** — the flag flip converts three latent defects
   into live-user facts. B1/B2/B8 are hard prerequisites, not preferences.
4. **`SessionScreen` stays untouched** (3.1k-line monolith) except where Tier 0 must reach it.
5. **The premium page is the most decision-dependent slice** (P6) and deliberately sized last; if
   the wave runs long it is the natural cut, and P1–P3 still deliver most of the value.
6. **Store re-review exposure** — the single §7 regen batch must precede the next submission;
   education-first ordering is unchanged by design.

---

## 10. What is NOT in Q2

Q3's library wave (Results Card 2.0, share templates, Ranges library + content, retention
additions, visual deep pass) is unchanged and out of scope. Multi-bankroll accounts are recorded
as a possible later premium addition. The richer `Settlement` nullable-party refactor stays
deferred. `SessionScreen` extraction stays deferred.
