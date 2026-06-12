# T Poker — Privacy Policy

> Source of truth for `apps/poker-mobile/public/privacy.html` (served at
> https://t-poker.vercel.app/privacy.html). Keep both in sync.

_Last updated: June 12, 2026_

T Poker is a private home-game poker management app. This policy explains what data
the app handles, where it lives, and what control you have over it.

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

## Data deletion

Delete your account from **Profile → Delete Account** in the app — this permanently
removes your account and personal data from our servers. Guest data is removed by
deleting games in-app or uninstalling.

## Data location

Account data: PostgreSQL on Railway. Web app: Vercel. Local guest data never leaves
the device.

## Children

Intended for adults organizing private home games; not directed at children under 17.

## Contact

tayshofer05@gmail.com
