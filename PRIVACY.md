# T Poker — Privacy Policy

> Source of truth for `apps/poker-mobile/public/privacy.html` (served at
> https://app.tpoker.app/privacy.html). Keep both in sync — the two must not drift.

_Last updated: July 23, 2026_

T Poker is a poker strategy-study app with a home-game scorekeeping tool, operated by
**Tay Shofer** (trading as True Story Labs). This policy explains what data the app handles,
where it lives, and what control you have over it.

## Guest mode — your game data stays on your device

You can use T Poker without creating an account. **Your game data** — games you run in guest
mode (players, buy-ins, cash-outs, settlements), your study progress, and your streaks — is
stored **only on your device** and is never sent to our servers. Deleting the app deletes this
data. Player names you enter in guest games refer to people at your table and exist only in
your device's local storage.

Separately from your game data, after you choose how to start the app (guest or sign-in) we
collect **anonymous usage analytics** — see the next section. You can turn this off any time in
Profile → Privacy.

## Anonymous usage analytics

To understand which features help players and which need work, we collect **anonymous usage
events** — for example "a quiz was completed" or "a game night was started" — using **PostHog**,
processed and stored on servers in the **European Union**. Collection begins **only after** you
make an explicit choice on the welcome screen, and you can switch it off any time in
**Profile → Privacy → "Share anonymous usage analytics."**

- **Included:** the feature used, screen flow, app version, platform (iOS/Android/web), and
  coarse device type.
- **Never included:** your game amounts, buy-ins or settlements, player names, hand contents,
  or messages. Guest analytics use a random identifier not linked to your name or email; if you
  sign in, events are associated with your account id so we can count active players.
- We do **not** sell this data or use it for advertising.

## Account data

If you create an account, we store:

- **Identity:** username, email, and a securely hashed password (bcrypt — never plain text). If
  you sign in with Google or Apple, we store that provider's account identifier and email.
- **Game data:** groups, sessions, buy-ins, cash-outs, settlements, hand records, session notes,
  and derived statistics (P&L, streaks, achievements).
- **Social data:** group memberships, invitations, in-app notifications.

## What we don't do

- No selling your data, and no sharing it with third parties for their own marketing.
- No ads or advertising trackers.
- No real-money transactions — the app only records what you track.

## Service providers

We rely on a few providers that process data **on our behalf only**, to provide their service to
us: **Railway** (database hosting), **Vercel** (web app), **PostHog** (anonymous usage analytics,
EU servers), and **Google / Apple** for optional sign-in. We do not sell your data to them or
allow them to use it for their own purposes.

## Payments & subscriptions

**Nothing in T Poker is currently purchasable.** Premium features are shown as "Coming soon" and
cannot be bought anywhere in the app or on the web. When premium launches, payments will be
processed by the app stores (**Apple App Store** / **Google Play**) — we will not see or store
your card details, and this policy will be updated before anything goes on sale. This is separate
from poker buy-ins and settlements, which T Poker only tracks and never processes — settling up
happens between you and your friends, outside the app.

## Authentication & security

Sign-in uses short-lived access tokens with rotating refresh tokens, stored in your device's
secure storage (Keychain on iOS, Keystore on Android). Passwords are hashed with bcrypt. Refresh
tokens are stored hashed on our servers.

## Delete your account & data

- **In the app:** Profile → Delete Account — permanently removes your account and all associated
  personal data (profile, game records, group memberships, notifications, device tokens) from our
  servers, immediately.
- **Without the app** (e.g. after uninstalling): email truestorylabs@gmail.com from your account's
  address with subject "Account deletion request"; we verify ownership and delete within 30 days
  with confirmation.
- Guest-mode game data never reaches our servers — delete games in-app or uninstall. Anonymous
  analytics can be switched off in Profile → Privacy; to request deletion of analytics data, email
  us with your approximate usage dates.

(Deletion-request URL for store forms: `https://app.tpoker.app/privacy.html#delete`)

## Data location

Account data is stored in a PostgreSQL database on Railway; the web app is served via Vercel.
Depending on those providers' regions, your data may be processed or stored on servers in the
United States or elsewhere. Anonymous usage analytics are processed by **PostHog on servers in
the European Union**. Local guest game data never leaves your device.

## Your rights & data retention

You can request access to, a copy of, or correction of the personal data we hold about you, and
you can delete your account and data at any time (see above). To make a request, email
truestorylabs@gmail.com.

We keep your account data while your account is active, and delete it on request or within 30 days
of account deletion. Depending on where you live, you may have additional rights under laws such
as the **GDPR** (EU/UK) or **CCPA** (California); we honor those rights where they apply.

## Responsible play & age

T Poker is a poker strategy-study app with a home-game scorekeeping tool, intended for adults
**18 and older**. It is not directed at or intended for children. T Poker does not offer, host, or
encourage real-money gambling — it only records the buy-ins, cash-outs, and settlements that
players track among themselves, like a shared ledger. Poker played for money can be risky and, for
some people, addictive. Please play responsibly and within the laws of your jurisdiction.

## Contact

Tay Shofer (True Story Labs) · truestorylabs@gmail.com

---

© 2026 Tay Shofer · T Poker
