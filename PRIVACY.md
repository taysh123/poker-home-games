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

## What we don't do

- No selling or sharing of data with third parties.
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
