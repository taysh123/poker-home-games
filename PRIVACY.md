# T Poker — Privacy Policy

> Source of truth for `apps/poker-mobile/public/privacy.html` (served at
> https://poker-home-games-three.vercel.app/privacy.html). Keep both in sync.

_Last updated: July 23, 2026_

T Poker is a poker strategy-study app with a home-game scorekeeping tool, operated by
**Tay Shofer** (trading as True Story Labs). This policy explains what data the app handles,
where it lives, and what control you have over it.

## Guest mode — your data stays on your device

You can use T Poker without creating an account. Games you run in guest mode
(players, buy-ins, cash-outs, settlements) are stored **only on your device** and are
never sent to our servers. Deleting the app deletes this data.

## Account data

If you create an account, we store:

- **Identity:** username, email, and a securely hashed password (bcrypt — never plain
  text). With Google sign-in, we store your Google account identifier and email.
- **Game data:** groups, sessions, buy-ins, cash-outs, settlements, hand records,
  session notes, and derived statistics (P&L, streaks, achievements).
- **Social data:** group memberships, invitations, in-app notifications.

## Anonymous usage analytics

Separately from your game data, we collect **anonymous usage events** — for example
"a quiz was completed" or "a game night was started" — using **PostHog**, processed and
stored on servers in the **European Union**. Collection begins **only after** you make an
explicit choice on the welcome screen, and you can switch it off any time in
**Profile → Privacy → "Share anonymous usage analytics."**

- **Included:** the feature used, screen flow, app version, platform (iOS/Android/web),
  and coarse device type.
- **Never included:** your game amounts, buy-ins or settlements, player names, hand
  contents, or messages. Guest analytics use a random identifier not linked to your name
  or email; if you sign in, events are associated with your account id so we can count
  active players.
- We do **not** sell this data or use it for advertising.

## Service providers

We rely on a few providers that process data **on our behalf only**, to provide their
service to us: **Railway** (database hosting), **Vercel** (web app), **PostHog**
(anonymous usage analytics, EU servers), and **Google / Apple** for optional sign-in. We
do not sell your data to them or allow them to use it for their own purposes.

## What we don't do

- No selling your data, and no sharing it with third parties for their own marketing.
- No ads or advertising trackers.
- No real-money transactions — the app only records what you track.

## Authentication & security

Short-lived access tokens with rotating refresh tokens, stored in device secure
storage (Keychain/Keystore). Refresh tokens are stored hashed server-side.

## Delete your account & data

- **In the app:** Profile → Delete Account — permanently removes your account and
  all associated personal data from our servers, immediately.
- **Without the app** (e.g. after uninstalling): email truestorylabs@gmail.com from
  your account's address with subject "Account deletion request"; we verify and
  delete within 30 days with confirmation.
- Guest data never reaches our servers — delete games in-app or uninstall.

(Deletion-request URL for store forms: `https://poker-home-games-three.vercel.app/privacy.html#delete`)

## Data location

Account data: PostgreSQL on Railway. Web app: Vercel. Local guest data never leaves
the device.

## Responsible play & age

T Poker is a poker strategy-study app with a home-game scorekeeping tool, intended for adults
**18 and older**. It is not directed at or intended for children. T Poker does not
offer, host, or encourage real-money gambling — it only records the buy-ins,
cash-outs, and settlements that players track among themselves, like a shared
ledger. Poker played for money can be risky and, for some people, addictive. Please
play responsibly and within the laws of your jurisdiction.

## Contact

Tay Shofer (True Story Labs) · truestorylabs@gmail.com

---

© 2026 Tay Shofer · T Poker
